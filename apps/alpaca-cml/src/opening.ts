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
import * as uniq from 'just-unique';
import sorter from 'sorters';
import * as hyperidMod from 'hyperid';
import got from 'got';
import {
  createBrokers,
  defaultAlpacaAuth,
  writePositions,
  pgp,
  db,
  Brokers,
} from 'trading-data';
const hyperid = hyperidMod();

interface OpeningTrade {
  symbol: string;
  type: string;
  closeAfter: number;
  efficiencyScore: number;
}

const dryRun = Boolean(process.env.DRY_RUN);

// These need to be updated for the real values.
const filters = {
  PreEarnings7DaysWithTechnicals: (data) => ({
    value: data.price > data.ma50,
    desc: `Price > MA50: ${data.price.toFixed(2)} > ${data.ma50.toFixed(2)}`,
  }),
  PreEarnings14DaysWithTechnicals: (data) => ({
    value: data.price > data.ma50,
    desc: `Price > MA50: ${data.price.toFixed(2)} > ${data.ma50.toFixed(2)}`,
  }),
  BigBollingerRecoveryBreakout: (data) => ({
    value: false,
    desc: 'price crosses above above 3SD bollinger',
  }),
  SmallBollingerRecoveryBreakout: (data) => ({
    value: false,
    desc: 'price crosses above lower 2SD bollinger',
  }),
  SmallBollingerUpsideBreakout: (data) => ({
    value: false, //data.price < data.ma200,
    desc: `Price < MA200: ${data.price.toFixed(2)} < ${data.ma200.toFixed(
      2
    )}, price above 2SD bollinger`,
  }),
  ClassicOversold: (data) => ({
    value: data.rsi14 < 30,
    desc: `RSI14: ${data.rsi14.toFixed(2)} < 30`,
  }),
  CMLOversold: (data) => ({
    value: data.rsi14 < 25 && data.PriceChange < 0,
    desc: `RSI14: ${data.rsi14.toFixed(
      2
    )} < 25, Price Change Negative: ${data.PriceChange.toFixed(2)}`,
  }),
  MACDBreakout: (data) => ({
    value: false,
    desc: 'MACD crosses up, price below upper Bollinger band',
  }),
  ThreeInsideUpWithRSI: (data) => {
    return {
      value: data.PriceChange > 0 && data.rsi14 < 60 && data.price < data.ma21,
      desc: `Price Change Positive: ${data.PriceChange.toFixed(
        2
      )}, RSI14: ${data.rsi14.toFixed(
        2
      )} < 60, Price < MA21: ${data.price.toFixed(2)} < ${data.ma21.toFixed(
        2
      )},`,
    };
  },
};

async function getTechnicals(symbols: string[]) {
  let getIt = () =>
    got({
      url: 'https://webservice.cmlviz.com/GetLiveTechnicals',
      timeout: 15000,
      searchParams: {
        auth: 'DEV1_nr82759gjRJ9Qm59FJbnqpeotr',
        tickers: symbols.join(','),
      },
      headers: {
        accept: 'application/json, text/javascript, */*; q=0.01',
        'accept-language': 'en-US,en;q=0.9',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        origin: 'https://www.cmlviz.com',
        referer: 'https://www.cmlviz.com/',
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36',
      },
    }).json<any[]>();

  console.log('fetching technicals');
  let data = await getIt();
  console.log('done');

  if (data.some((d) => d.statusMessage)) {
    // Need to fetch again
    console.log('refetching technicals');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    data = await getIt();
  }

  return data;
}

let api: Brokers;
async function run() {
  let trades: OpeningTrade[] = require('./trades.json');
  let symbols: string[] = uniq(trades.map((t) => t.symbol));

  api = await createBrokers({
    alpaca: defaultAlpacaAuth(),
  });

  let [[account], positions, dayBars, data, maData] = await Promise.all([
    api.getAccount(BrokerChoice.alpaca),
    api.getPositions(BrokerChoice.alpaca),
    api.getBars({
      symbols,
      timeframe: BarTimeframe.day,
      start: new Date(),
      end: new Date(),
    }),
    api.getQuotes(symbols),
    getTechnicals(symbols),
  ]);

  let maDataBySymbol = {};
  for (let data of maData) {
    maDataBySymbol[data.Ticker] = data;
  }

  let openSymbols = new Set(positions.map((p) => p.symbol));

  let quotes = {};
  for (let [symbol, quote] of Object.entries(data)) {
    quotes[symbol] = {
      ...maDataBySymbol[symbol],
      ...quote,
      price: quote.mark,
    };
  }

  let results = trades
    .map((trade) => {
      let data = dayBars.get(trade.symbol)?.[0];
      if (!data) {
        console.log(`No day bar for ${trade.symbol}`);
        return null;
      }

      let filter = filters[trade.type];
      if (!filter) {
        console.log(
          `Unknown strategy ${trade.type} for symbol ${trade.symbol}`
        );
        return null;
      }

      let filterResult = filter(quotes[trade.symbol]);
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
      }

      let quote = quotes[trade.symbol];
      // Rough dollar-weighted volume from yesterday. Better would be to get broken-out bars but this is ok for now just to see if a symbol is liquid or not.
      let dwVol = ((data.high + data.low) / 2) * data.volume;
      return {
        ...trade,
        price: quote.price,
        dwVol,
      };
    })
    .filter((t) => t)
    .sort(sorter({ value: 'efficiencyScore', descending: true }));

  const MAX_TRADES = 5;

  console.dir(account);
  let riskPerTrade = Math.min(
    account.portfolioValue * 0.02,
    (account.cash / Math.min(results.length, MAX_TRADES)) * 0.95
  );

  console.log(`Max risk ${riskPerTrade.toFixed(2)}`);
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
    if (openedTrades === MAX_TRADES) {
      console.log(`Exiting at max of ${MAX_TRADES} per day`);
      break;
    }
  }

  let doneOrders = await api.waitForOrders(BrokerChoice.alpaca, {
    orderIds,
    after: currDate,
    progress: ({ statusCounts }) => {
      console.log(statusCounts);
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
}

run()
  .then(() => {
    pgp.end();
    return api?.end();
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
