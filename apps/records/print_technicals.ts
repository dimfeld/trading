#!/usr/bin/env ts-node
import { createBrokers } from 'trading-data';
import { BarTimeframe } from 'types';
import { technicalCalculator } from 'options-analysis';

async function run() {
  let brokers = await createBrokers();
  let symbol = process.argv[2];
  let [bars, quotes] = await Promise.all([
    brokers.getBars({
      symbols: [symbol],
      timeframe: BarTimeframe.day,
    }),
    brokers.getQuotes([symbol]),
  ]);

  let tech = technicalCalculator(symbol, bars.get(symbol));
  let latest = tech.latest(quotes[symbol].mark);

  let { prices, ...printable } = latest;
  console.dir(printable);
  return brokers.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
