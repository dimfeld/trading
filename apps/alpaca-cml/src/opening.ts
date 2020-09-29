#!/usr/bin/env ts-node
import 'source-map-support/register';
import {
  Position,
  BarTimeframe,
  Quote,
  BrokerChoice,
  OrderType,
  DbTrade,
  DbPosition,
  OrderStatus,
  Account,
  Bar,
} from 'types';
import * as date from 'date-fns';
import * as uniq from 'just-unique';
import sorter from 'sorters';
import * as hyperidMod from 'hyperid';
import {
  createBrokers,
  defaultAlpacaAuth,
  writePositions,
  pgp,
  db,
  Brokers,
} from 'trading-data';
import {
  ema,
  LatestTechnicals,
  TechnicalCalculator,
  technicalCalculator,
} from 'options-analysis';
const hyperid = hyperidMod();

interface OpeningTrade {
  symbol: string;
  type: string;
  closeAfter: number;
  efficiencyScore: number;
}

const dryRun = Boolean(process.env.DRY_RUN);

interface Technicals extends LatestTechnicals {
  yesterdayClose: number;
  priceChange: number;
}

function macdCrossoverUp(technicals: Technicals) {
  let ema12 = [technicals.ema12, ...technicals.previous.ema12];
  let ema26 = [technicals.ema26, ...technicals.previous.ema26];
  let diff = new Array(Math.min(ema12.length, ema26.length));
  for (let i = 0; i < diff.length; ++i) {
    diff[i] = ema12[i] - ema26[i];
  }

  let emaDiff = ema(diff, 9);

  let current = diff[0] - emaDiff[0] > 0;
  let yesterday = diff[1] - emaDiff[1] > 0;
  return current && !yesterday;
}

// These need to be updated for the real values.
const filters: {
  [strategy: string]: (t: Technicals) => { value: boolean; desc: string };
} = {
  PreEarnings7DaysWithTechnicals: (data) => ({
    value: data.latest > data.ma50,
    desc: `Price > MA50: ${data.latest.toFixed(2)} > ${data.ma50.toFixed(2)}`,
  }),
  PreEarnings14DaysWithTechnicals: (data) => ({
    value: data.latest > data.ma50,
    desc: `Price > MA50: ${data.latest.toFixed(2)} > ${data.ma50.toFixed(2)}`,
  }),
  BigBollingerRecoveryBreakout: (data) => ({
    value:
      data.yesterdayClose <= data.previous.bollinger.lower3SD &&
      data.latest > data.bollinger.lower3SD,
    desc: `price ${data.latest.toFixed(
      2
    )} crosses above lower 3SD bollinger ${data.bollinger.upper3SD.toFixed(2)}`,
  }),
  SmallBollingerRecoveryBreakout: (data) => ({
    value:
      data.yesterdayClose <= data.previous.bollinger.lower2SD &&
      data.latest > data.bollinger.lower2SD,
    desc: `price ${data.latest.toFixed(
      2
    )} crosses above lower 2SD bollinger ${data.bollinger.lower2SD.toFixed(2)}`,
  }),
  SmallBollingerUpsideBreakout: (data) => ({
    value:
      data.latest < data.ma200 &&
      data.yesterdayClose < data.previous.bollinger.upper2SD &&
      data.latest > data.bollinger.upper2SD,
    desc: `Price < MA200: ${data.latest.toFixed(2)} < ${data.ma200.toFixed(
      2
    )}, price above 2SD bollinger ${data.bollinger.upper2SD}`,
  }),
  ClassicOversold: (data) => ({
    value: data.rsi14 < 30,
    desc: `RSI14: ${data.rsi14.toFixed(2)} < 30`,
  }),
  CMLOversold: (data) => ({
    value: data.rsi14 < 25 && data.priceChange < 0,
    desc: `RSI14: ${data.rsi14.toFixed(
      2
    )} < 25, Price Change Negative: ${data.priceChange.toFixed(2)}`,
  }),
  MACDBreakout: (data) => ({
    value:
      data.latest < data.ma200 &&
      data.latest < data.bollinger.upper2SD &&
      macdCrossoverUp(data),
    desc: `price (${
      data.latest
    }) below upper Bollinger band (${data.bollinger.upper2SD.toFixed(
      2
    )}) and ma200 (${data.ma200.toFixed(
      2
    )}), MACD crosses up (ema26 ${data.ema26.toFixed(
      2
    )}, ema12 ${data.ema12.toFixed(2)})`,
  }),
  ThreeInsideUpWithRSI: (data) => {
    return {
      value:
        data.priceChange > 0 && data.rsi14 < 60 && data.latest < data.ema21,
      desc: `Price Change Positive: ${data.priceChange.toFixed(
        2
      )}, RSI14: ${data.rsi14.toFixed(
        2
      )} < 60, Price < MA21: ${data.latest.toFixed(2)} < ${data.ema21.toFixed(
        2
      )},`,
    };
  },
};

async function run() {
  let untradable = new Set(['SPX', 'SPXW', 'SPXC', 'XSP']);
  let trades: OpeningTrade[] = require('../trades.json');
  let symbols: string[] = uniq(
    trades.map((t) => t.symbol).filter((s) => !untradable.has(s))
  );

  let api = await createBrokers();

  let [[account], positions, dayBars, data, calendar] = await Promise.all([
    api.getAccount(BrokerChoice.alpaca),
    api.getPositions(BrokerChoice.alpaca),
    api.getBars({
      symbols,
      timeframe: BarTimeframe.day,
    }),
    api.getQuotes(symbols),
    api.marketCalendar(),
  ]);

  let quotes = new Map<string, Technicals>();
  for (let symbol of symbols) {
    let bars = dayBars.get(symbol);
    if (!bars) {
      console.error(`No daily bars for symbol ${symbol}`);
      continue;
    }

    let quote = data[symbol];
    if (!quote) {
      console.error(`No quote for symbol ${symbol}`);
      continue;
    }

    if (bars.length < 200) {
      console.error(`Skipping ${symbol} because it has < 200 bars`);
      continue;
    }

    let calc = technicalCalculator(symbol, bars);
    let price = quote.mark || quote.lastPrice;
    let technicals = calc.latest(price);
    quotes.set(symbol, {
      priceChange: quote.netChange,
      yesterdayClose: price - quote.netChange,
      ...technicals,
    });
  }

  let openSymbols = new Set(positions.map((p) => p.symbol));

  let results = trades
    .map((trade) => {
      let data = quotes.get(trade.symbol);
      if (!data) {
        console.log(`No data for ${trade.symbol}`);
        return null;
      }

      let filter = filters[trade.type];
      if (!filter) {
        console.log(
          `Unknown strategy ${trade.type} for symbol ${trade.symbol}`
        );
        return null;
      }

      // console.dir(data);
      let filterResult = filter(data);
      console.log(
        `Checking ${trade.symbol} criteria for ${trade.type}: ${filterResult.desc}`
      );
      if (!filterResult.value) {
        console.log(`  ${trade.symbol} does not meet criteria`);
        return null;
      }

      if (trade.type === 'PreEarnings7DaysWithTechnicals') {
        trade.closeAfter = 6;
      } else if (trade.type === 'PreEarnings14DaysWithTechnicals') {
        trade.closeAfter = 13;
      } else {
        // Figure out the number of trading days.
        let closeDate = calendar.next[trade.closeAfter].date;
        trade.closeAfter = date.differenceInCalendarDays(closeDate, new Date());
      }

      // Rough dollar-weighted volume from yesterday. Better would be to get broken-out bars but this is ok for now just to see if a symbol is liquid or not.
      let bar = data.prices[0];
      let dwVol = ((bar.high + bar.low) / 2) * bar.volume;
      return {
        ...trade,
        price: data.latest,
        dwVol,
      };
    })
    .filter((t) => t && t.efficiencyScore >= 1)
    .sort(sorter({ value: 'efficiencyScore', descending: true }));

  const MAX_TRADES = 5;

  console.dir(account);
  let maxRiskPerTrade = account.portfolioValue * 0.02;
  let maxTrades = Math.min(
    MAX_TRADES,
    Math.floor(account.cash / maxRiskPerTrade)
  );
  let riskPerTrade = Math.min(
    maxRiskPerTrade,
    (account.cash / Math.min(results.length, maxTrades)) * 0.95
  );

  console.log(`Max risk ${riskPerTrade.toFixed(2)} for ${maxTrades} trades`);
  // console.dir(results);

  let orderIds = new Set<string>();
  let currDate = new Date();

  let openedTrades = 0;
  let seenSymbols = new Map<string, OpeningTrade>();
  for (let trade of results) {
    // console.log(`looking at ${trade.symbol}`);
    if (seenSymbols.has(trade.symbol)) {
      // Already looked at this symbol.
      // console.log('already seen');
      continue;
    } else if (openSymbols.has(trade.symbol)) {
      console.log(`Skipping ${trade.symbol} because it is already open`);
      continue;
    } else if (trade.price > riskPerTrade) {
      console.log(
        `Skipping ${trade.symbol} because price ${trade.price} is larger than max risk ${riskPerTrade}`
      );
      continue;
    }

    let numShares = Math.floor(riskPerTrade / trade.price);
    console.log(
      `Opening Trade: ${
        trade.symbol
      } -- ${numShares} shares at ${trade.price.toFixed(2)} -- score ${
        trade.efficiencyScore
      } -- close after ${trade.closeAfter} days`
    );

    if (!dryRun) {
      // todo replace market orders with a more intellligent price adjustmeng algorithm.
      let order = await api.createOrder(BrokerChoice.alpaca, {
        type: OrderType.market,
        legs: [
          {
            symbol: trade.symbol,
            size: numShares,
          },
        ],
        // type: OrderType.limit,
        // price: trade.price,
      });

      orderIds.add(order.id);
    }
    seenSymbols.set(trade.symbol, trade);

    openedTrades++;
    if (openedTrades === maxTrades) {
      console.log(`Exiting at max of ${maxTrades} per day`);
      break;
    }
  }

  let doneOrders = await api.waitForOrders(BrokerChoice.alpaca, {
    orderIds,
    after: currDate,
    progress: ({ message }) => {
      console.log(message);
    },
  });

  let orderDb: DbTrade[] = [];
  let positionDb: DbPosition[] = [];
  for (let order of doneOrders.values()) {
    if (order.status !== OrderStatus.filled) {
      continue;
    }

    let leg = order.legs[0];
    let posId = hyperid();
    let gross = -leg.size * order.price;
    orderDb.push({
      id: order.id,
      position: posId,
      legs: [
        {
          size: leg.size,
          price: leg.price,
          symbol: leg.symbol,
        },
      ],
      tags: [],
      gross,
      traded: order.traded,
      price_each: order.price,
      commissions: 0,
    });

    let tradeStructure = seenSymbols.get(leg.symbol);
    positionDb.push({
      id: posId,
      tags: [],
      symbol: leg.symbol,
      strategy: 46, // hardcoded alpaca strategy for now
      open_date: order.traded,
      close_date: null,
      cost_basis: gross,
      buying_power: null,
      profit: gross,
      legs: [
        {
          size: leg.filled,
          symbol: leg.symbol,
        },
      ],
      broker: BrokerChoice.alpaca,
      note: tradeStructure.type,
      structure: {
        conditions: {
          closing: {
            after_days: tradeStructure.closeAfter,
          },
        },
      },
    });
  }

  if (orderDb.length) {
    await db.tx(async (tx) => {
      await writePositions(positionDb, orderDb, tx);
    });
  }

  return api.end();
}

run()
  .then(() => {
    pgp.end();
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
