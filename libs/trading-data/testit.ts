#!/usr/bin/env ts-node

import { BarTimeframe } from 'types';
import * as data from './src';
import * as date from 'date-fns';
import { writeFileSync } from 'fs';
import sorter from 'sorters';

async function run() {
  let brokers = await data.createBrokers();
  let cal = await brokers.marketCalendar();
  let startIndex = 200;
  let symbol = 'MSFT';
  console.log(`Getting bars starting at ${cal.current[startIndex].date}`);
  let bars = await brokers.getBars({
    symbols: [symbol],
    timeframe: BarTimeframe.day,
    // start: cal.current[startIndex].date,
  });

  let aapl = bars.get(symbol).sort(
    sorter<any>({ value: (d) => d.time.valueOf(), descending: true })
  );
  let dates = aapl.map((d) => date.formatISO9075(d.time));
  console.log(`Got ${aapl.length} bars`);
  console.log(dates.join(', '));
  writeFileSync('test-bars.json', JSON.stringify(aapl));

  return brokers.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
