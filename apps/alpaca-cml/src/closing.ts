#!/usr/bin/env ts-node
import { pgp, db, tradeColumns, positionColumns } from './services';
import * as date from 'date-fns';
import sorter from 'sorters';
import * as chalk from 'chalk';
import { createBrokers, defaultAlpacaAuth } from 'trading-data';
import { Position, BrokerChoice, OrderType } from 'types';

function format(x, digits = 2) {
  return Number(x).toFixed(digits);
}

async function run() {
  let api = await createBrokers({
    alpaca: defaultAlpacaAuth(),
  });

  let [account, aPositions, dbPositions]: [
    any,
    Position[],
    any[]
  ] = await Promise.all([
    api.getAccount(),
    api.getPositions(),
    db.query(
      `SELECT * FROM positions WHERE close_date IS NULL AND broker='alpaca'`
    ),
  ]);

  // For now we assume that there is only one position per symbol open at a time.

  let positions: { [symbol: string]: { db: any; broker: Position } } = {};
  for (let pos of dbPositions) {
    if (positions[pos.symbol]) {
      throw new Error(
        `DB has multiple open Alpaca positions for symbol ${pos.symbol}`
      );
    }

    positions[pos.symbol] = {
      db: pos,
      broker: null,
    };
  }

  let symbols = Object.keys(positions);
  let quotes = await api.getQuotes(symbols);

  for (let pos of aPositions) {
    let existing = positions[pos.symbol];
    if (!existing) {
      console.error(
        `WARNING: No position in database for symbol ${pos.symbol}`
      );
    }

    existing.broker = pos;
  }

  let currDate = new Date();

  let totalCostBasis = 0;
  let totalValue = 0;
  let totalPL = 0;
  let totalPLToday = 0;

  let orderIds = [];
  for (let pos of Object.values(positions).sort(sorter('db.symbol'))) {
    if (!pos.broker) {
      console.error(
        `WARNING: DB Position ${pos.db.id} for symbol ${pos.db.symbol} has no match in Broker`
      );
      continue;
    }

    let closeAfter = pos.db.structure?.conditions?.closing?.after_days;
    if (!closeAfter) {
      console.error(
        `WARNING: Position ${pos.db.id} for symbol ${pos.db.symbol} has no "close after" time`
      );
      continue;
    }

    let price = quotes[pos.broker.symbol].lastPrice;
    let costBasis = pos.broker.price * pos.broker.size;
    let marketValue = pos.broker.size * price;
    let unrealizedPl = marketValue - costBasis;
    let unrealizedPlPct = (unrealizedPl / costBasis) * 100;

    let todayPl = pos.broker.size * quotes[pos.broker.symbol].netChange;
    let todayPlPct = (todayPl / (marketValue - todayPl)) * 100;

    totalCostBasis += costBasis;
    totalValue += marketValue;
    totalPL += unrealizedPl;
    totalPLToday += todayPl;

    let closeDate = date.addDays(new Date(pos.db.open_date), closeAfter);
    let closeDateText = date.isToday(closeDate)
      ? 'today'
      : `in ${date.formatDistanceToNow(closeDate)}`;
    console.log(
      `${pos.broker.symbol.padEnd(5, ' ')} -- P/L $${format(
        unrealizedPl
      )} (${format(unrealizedPlPct, 1)}%), Today $${format(todayPl)} (${format(
        todayPlPct,
        1
      )}%), Value $${format(marketValue)} from $${format(
        costBasis
      )}. Close ${closeDateText}`
    );

    if (date.isToday(closeDate) || date.isPast(closeDate)) {
      console.log(
        `${chalk.green('Closing position')} ${pos.db.id}: ${
          pos.broker.size
        } shares of ${pos.broker.symbol}`
      );

      let order = await api.createOrder(BrokerChoice.alpaca, {
        type: OrderType.market,
        legs: [
          {
            symbol: pos.broker.symbol,
            size: -pos.broker.size,
          },
        ],
      });
      orderIds.push(order.id);
    }
  }

  let doneOrders = await api.waitForOrders(BrokerChoice.alpaca, {
    orderIds,
    after: currDate,
    progress: ({ statusCounts }) => console.log(statusCounts),
  });

  let totalPLPercent = (totalValue / totalCostBasis - 1) * 100;
  let totalPLPercentToday = (totalPLToday / (totalValue - totalPLToday)) * 100;
  console.log(
    `Total -- P/L: $${format(totalPL)} (${format(
      totalPLPercent
    )}%), Today: $${format(totalPLToday)} (${format(
      totalPLPercentToday
    )}%), Value $${format(totalValue)} from $${format(totalCostBasis)}. `
  );

  console.log();

  if (!doneOrders.size) {
    console.log('No actions to take...');
    return;
  }

  let orderDb = [];
  let positionDb = [];

  for (let order of doneOrders.values()) {
    let position = positions[order.symbol];
    let gross = +order.filled_qty * +order.filled_avg_price;
    let tradeDate = new Date(order.filled_at);
    orderDb.push({
      id: order.id,
      position: position.db.id,
      legs: [
        {
          size: -order.filled_qty,
          price: order.filled_avg_price,
          symbol: order.symbol,
        },
      ],
      tags: [],
      gross,
      traded: tradeDate,
      commissions: 0,
    });

    positionDb.push({
      id: position.db.id,
      close_date: tradeDate,
      profit: position.db.profit + gross,
      legs: [],
    });
  }

  let orderQuery = pgp.helpers.insert(orderDb, tradeColumns, 'trades');
  let posUpdate =
    pgp.helpers.update(
      positionDb,
      [
        '?id',
        { name: 'close_date', cast: 'date' },
        'profit',
        { name: 'legs', mod: ':json', cast: 'jsonb' },
      ],
      'positions'
    ) + ' where t.id=v.id';

  await db.tx(async (tx) => {
    await tx.query(orderQuery);
    await tx.query(posUpdate);
  });
}

run()
  .then(() => {
    pgp.end();
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
