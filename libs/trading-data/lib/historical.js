"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPriceHistory = void 0;
const sorters_1 = require("sorters");
const debugMod = require("debug");
const types_1 = require("types");
const debug = debugMod('historical');
async function downloadPrices(brokers, symbols, size) {
    debug('Downloading history for %s', symbols);
    let now = new Date();
    let data = await brokers.getBars({
        symbols,
        timeframe: types_1.BarTimeframe.day,
        end: now,
        limit: size,
    });
    let output = new Map();
    for (let [symbol, bars] of data.entries()) {
        let priceList = bars
            .sort(sorters_1.default({ value: (b) => b.time.valueOf(), descending: true }))
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
async function getPriceHistory(brokers, symbols, history = 200) {
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
exports.getPriceHistory = getPriceHistory;
//# sourceMappingURL=historical.js.map