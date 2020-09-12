#!/usr/bin/env ts-node
import * as date from 'date-fns';
import sorter from 'sorters';
import * as chalk from 'chalk';
import {
  createBrokers,
  defaultAlpacaAuth,
  updateMultiplePositions,
  addTrades,
  pgp,
  db,
  defaultTdaAuth,
  Brokers,
} from 'trading-data';
import { Position, BrokerChoice, OrderType, DbPosition, Order } from 'types';

const dryRun = Boolean(process.env.DRY_RUN);

function format(x, digits = 2) {
  return Number(x).toFixed(digits);
}

let api: Brokers;
async function run() {
  api = await createBrokers({});

  let [[account], aPositions, dbPositions]: [
    any,
    Position[],
    any[]
  ] = await Promise.all([
    api.getAccount(BrokerChoice.alpaca),
    api.getPositions(BrokerChoice.alpaca),
    db.query(
      `SELECT * FROM positions WHERE close_date IS NULL AND broker='alpaca'`
    ),
  ]);

  // For now we assume that there is only one position per symbol open at a time.

  let positions: {
    [symbol: string]: { db: DbPosition; broker: Position };
  } = {};
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
      continue;
    }

    existing.broker = pos;
  }

  let currDate = new Date();

  let totalCostBasis = 0;
  let totalValue = 0;
  let totalPL = 0;
  let totalPLToday = 0;

  let doneOrders = await api.getOrders(BrokerChoice.alpaca, {
    filled: true,
    startDate: date.setHours(new Date(), 0),
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

  if (!doneOrders.length) {
    console.log('No actions to take...');
    return;
  }

  let orderDb = [];
  let positionDb = [];

  for (let order of doneOrders) {
    console.dir(order);
    // We know there's only one leg for these trades.
    let leg = order.legs[0];
    let position = positions[leg.symbol];
    let gross = +leg.filled * +order.price;
    let tradeDate = new Date(order.traded);
    orderDb.push({
      id: order.id,
      position: position.db.id,
      legs: [
        {
          size: -leg.filled,
          price: leg.price,
          symbol: leg.symbol,
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

  console.dir(orderDb, { depth: null });
  console.dir(positionDb);

  if (orderDb.length) {
    await db.tx(async (tx) => {
      await addTrades(orderDb, tx);
      await updateMultiplePositions(
        ['close_date', 'profit', 'legs'],
        positionDb,
        tx
      );
    });
  }
}

run()
  .then(() => {
    pgp.end();
    if (api) {
      return api.end();
    }
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
