"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPriceHistory = void 0;
const _ = require("lodash");
const config = require("./config");
const services_1 = require("./services");
const path = require("path");
const qs = require("querystring");
const dateFns = require("date-fns");
const findUp = require("find-up");
const got = require("got");
const util_1 = require("util");
const sorters_1 = require("sorters");
const debugMod = require("debug");
const debug = debugMod('historical');
var alphavantageKey = process.env.ALPHAVANTAGE_KEY;
async function downloadPrices(symbol, full = false) {
    var _a;
    debug("Downloading history for %s full=%s", symbol, full);
    if (!alphavantageKey) {
        try {
            let dirName = require.main ? path.dirname(require.main.filename) : process.cwd();
            if (dirName.indexOf('ts-node') >= 0) {
                dirName = process.cwd();
            }
            let configPath = await findUp('alphavantage.json', { cwd: dirName });
            if (!configPath) {
                throw new Error(`Could not find alphavantage.json config file`);
            }
            let alphavantageConfig = require(configPath);
            alphavantageKey = alphavantageConfig.key;
        }
        catch (e) {
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
    let results = Object.entries(((_a = data.body) === null || _a === void 0 ? void 0 : _a['Time Series (Daily)']) || {})
        .map(([date, prices]) => {
        let closing = prices['4. close'];
        if (!closing) {
            throw new Error(`Data format changed in ${util_1.inspect(prices)}`);
        }
        return { date: new Date(date), price: Math.round(closing * 100) };
    })
        .filter(({ date }) => date.getUTCFullYear() >= earliestYear)
        .sort(sorters_1.default({ value: (d) => d.date.valueOf(), descending: true }));
    let now = new Date();
    // Market is still open, so omit any data from today.
    if (now.getUTCHours() < 16 && dateFns.isSameDay(now, results[0].date)) {
        results.shift();
    }
    let insertValues = results.map((result) => `('${symbol}',${services_1.pgp.as.text(result.date)},${services_1.pgp.as.number(result.price)})`).join(',');
    let insertQuery = `INSERT INTO ${config.postgres.tables.historical_equity_prices} (symbol,date,price) VALUES
    ${insertValues}
    ON CONFLICT (symbol,date) DO UPDATE SET price=EXCLUDED.price`;
    debug(insertQuery);
    await services_1.db.none(insertQuery);
    return results;
}
async function getPriceHistory(symbol, history = 200) {
    var _a;
    let rows = await services_1.db.query(`SELECT date, price FROM ${config.postgres.tables.historical_equity_prices}
    WHERE symbol=$[symbol]
    ORDER BY date DESC
    LIMIT $[history]`, { symbol, history });
    // Find the latest date that we expect to see trading. This doesn't account for holidays.
    let latestDate = dateFns.subDays(new Date(), 1);
    while (dateFns.isWeekend(latestDate)) {
        latestDate = dateFns.subDays(latestDate, 1);
    }
    let latestFoundDate = (_a = rows[0]) === null || _a === void 0 ? void 0 : _a.date;
    debug('latestDate', latestDate);
    debug('latestFoundDate', latestFoundDate);
    if (!latestFoundDate) {
        // No data. Get a couple years worth.
        let data = await downloadPrices(symbol, true);
        rows = data.slice(0, history);
    }
    else if (dateFns.getDayOfYear(latestFoundDate) < dateFns.getDayOfYear(latestDate)) {
        // Refresh to get the current data.
        // Only get the full data if we need it. The compact form is the last 100 trading days.
        let needsFull = history - rows.length >= 99;
        let data = await downloadPrices(symbol, needsFull);
        let latestDateLocation = _.findIndex(data, (d) => dateFns.isSameDay(d.date, latestFoundDate));
        if (latestDateLocation !== -1) {
            rows = data.slice(0, latestDateLocation).concat(rows);
        }
    }
    return rows;
}
exports.getPriceHistory = getPriceHistory;
//# sourceMappingURL=historical.js.map