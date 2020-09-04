import * as _ from 'lodash';
import * as config from './config';
import { db, pgp } from './services';
import * as path from 'path';
import * as qs from 'querystring';
import * as dateFns from 'date-fns';
import findUp = require('find-up');
import got = require('got');
import { inspect } from 'util';
import sorter from 'sorters';
import * as debugMod from 'debug';
const debug = debugMod('historical');

export interface HistoricalPrice {
  date: Date;
  price: number;
}

var alphavantageKey = process.env.ALPHAVANTAGE_KEY;

async function downloadPrices(symbol : string, full = false) : Promise<HistoricalPrice[]> {
  debug("Downloading history for %s full=%s", symbol, full);
  if(!alphavantageKey) {
    try {
      let dirName = require.main ? path.dirname(require.main.filename) : process.cwd();
      if(dirName.indexOf('ts-node') >= 0) {
        dirName = process.cwd();
      }

      let configPath = await findUp('alphavantage.json', { cwd: dirName });
      if(!configPath) {
        throw new Error(`Could not find alphavantage.json config file`);
      }

      let alphavantageConfig = require(configPath);
      alphavantageKey = alphavantageConfig.key;
    } catch(e) {
      e.message = `Loading Alphavantage key: ${e.message}`;
      throw e;
    }
  }

  let args = qs.stringify({
    apikey: alphavantageKey,
    symbol,
    function: 'TIME_SERIES_DAILY',
    outputsize: full ? 'full' : 'compact',
  });

  let data = await got(`https://www.alphavantage.co/query?${args}`, { json: true });

  let earliestYear = ((new Date()).getFullYear() - 1);
  let results = Object.entries(data.body?.['Time Series (Daily)'] || {})
    .map(([date, prices]) => {
      let closing = prices['4. close'];
      if(!closing) {
        throw new Error(`Data format changed in ${inspect(prices)}`);
      }

      return { date: new Date(date), price: Math.round(closing * 100) };
    })
    .filter(({ date }) => date.getUTCFullYear() >= earliestYear)
    .sort(sorter<HistoricalPrice>({ value: (d) => d.date.valueOf(), descending: true }));

  let now = new Date();
  // Market is still open, so omit any data from today.
  if(now.getUTCHours() < 16 && dateFns.isSameDay(now, results[0].date)) {
    results.shift();
  }

  let insertValues = results.map((result) => `('${symbol}',${pgp.as.text(result.date)},${pgp.as.number(result.price)})`).join(',');
  let insertQuery = `INSERT INTO ${config.postgres.tables.historical_equity_prices} (symbol,date,price) VALUES
    ${insertValues}
    ON CONFLICT (symbol,date) DO UPDATE SET price=EXCLUDED.price`;

  debug(insertQuery);
  await db.none(insertQuery);

  return results;
}

export async function getPriceHistory(symbol: string, history=200) {
  let rows = await db.query<HistoricalPrice[]>(`SELECT date, price FROM ${config.postgres.tables.historical_equity_prices}
    WHERE symbol=$[symbol]
    ORDER BY date DESC
    LIMIT $[history]`, { symbol, history });

  // Find the latest date that we expect to see trading. This doesn't account for holidays.
  let latestDate = dateFns.subDays(new Date(), 1);
  while(dateFns.isWeekend(latestDate)) {
    latestDate = dateFns.subDays(latestDate, 1);
  }

  let latestFoundDate : Date = rows[0]?.date;
  debug('latestDate', latestDate);
  debug('latestFoundDate', latestFoundDate);

  if(!latestFoundDate) {
    // No data. Get a couple years worth.
    let data = await downloadPrices(symbol, true);
    rows = data.slice(0, history);
  } else if(dateFns.getDayOfYear(latestFoundDate) < dateFns.getDayOfYear(latestDate)) {
    // Refresh to get the current data.
    // Only get the full data if we need it. The compact form is the last 100 trading days.
    let needsFull = history - rows.length >= 99;
    let data = await downloadPrices(symbol, needsFull);
    let latestDateLocation = _.findIndex(data, (d) => dateFns.isSameDay(d.date, latestFoundDate));
    if(latestDateLocation !== -1) {
      rows = data.slice(0, latestDateLocation).concat(rows);
    }
  }

  return rows;
}
