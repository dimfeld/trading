import * as config from './config';
import { db, pgp } from './services';
import * as dateFns from 'date-fns';
import sorter from 'sorters';
import * as debugMod from 'debug';
import { Brokers } from './brokers';
import { BarTimeframe, Bar } from 'types';
const debug = debugMod('historical');

export interface HistoricalPrice {
  date: Date;
  /** Price as an integer. Divide by 100 to get actual price. */
  price: number;
  volume: number;
}

async function downloadPrices(
  brokers: Brokers,
  symbols: string[],
  size: number
): Promise<Map<string, HistoricalPrice[]>> {
  debug('Downloading history for %s', symbols);

  let now = new Date();

  let data = await brokers.getBars({
    symbols,
    timeframe: BarTimeframe.day,
    end: now,
    limit: size,
  });

  let output = new Map<string, HistoricalPrice[]>();
  for (let [symbol, bars] of data.entries()) {
    let priceList = bars
      .sort(
        sorter<Bar>({ value: (b) => b.time.valueOf(), descending: true })
      )
      .map((b) => {
        return {
          symbol,
          date: b.time,
          price: Math.round(b.close * 100),
          volume: b.volume,
        };
      });

    output.set(symbol, priceList);
  }

  // Skip the local cache for now.
  // let allRecords = Array.from(output.values()).flat();

  // let insertQuery =
  //   pgp.helpers.insert(
  //     allRecords,
  //     ['symbol', 'date', 'price', 'volume'],
  //     config.postgres.tables.historical_equity_prices
  //   ) +
  //   ` ON CONFLICT (symbol,date) DO UPDATE SET price=EXCLUDED.price, volume=EXCLUDED.volume`;

  // debug(insertQuery);
  // await db.none(insertQuery);

  return output;
}

export async function getPriceHistory(
  brokers: Brokers,
  symbols: string[],
  history = 200
): Promise<Map<string, HistoricalPrice[]>> {
  return downloadPrices(brokers, symbols, history);

  // For simplicity we don't currently read from the cache.

  // let rows = await db.query<HistoricalPrice[]>(
  //   `SELECT symbol, date, price FROM ${config.postgres.tables.historical_equity_prices}
  //   WHERE symbol=ANY($[symbols]) AND date >= $[minDate]
  //   ORDER BY date DESC`,
  //   { symbols, minDate: dateFns.subDays(new Date(), history + 1) }
  // );

  // // Find the latest date that we expect to see trading. This doesn't account for holidays.
  // let latestDate = dateFns.subDays(new Date(), 1);
  // while (dateFns.isWeekend(latestDate)) {
  //   latestDate = dateFns.subDays(latestDate, 1);
  // }

  // let latestFoundDate: Date = rows[0]?.date;
  // debug('latestDate', latestDate);
  // debug('latestFoundDate', latestFoundDate);

  // if (!latestFoundDate) {
  //   // No data. Get 200 days worth which is the longest we currently use.
  //   let data = await downloadPrices(brokers, symbols, 200);
  // } else if (
  //   dateFns.getDayOfYear(latestFoundDate) < dateFns.getDayOfYear(latestDate)
  // ) {
  //   // Refresh to get the current data.
  //   // Only get the full data if we need it. The compact form is the last 100 trading days.
  //   let needsFull = history - rows.length >= 99;
  //   let data = await downloadPrices(symbol, needsFull);
  //   let latestDateLocation = _.findIndex(data, (d) =>
  //     dateFns.isSameDay(d.date, latestFoundDate)
  //   );
  //   if (latestDateLocation !== -1) {
  //     rows = data.slice(0, latestDateLocation).concat(rows);
  //   }
  // }

  // return rows;
}
