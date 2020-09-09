"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const date = require("date-fns");
function totalForDays(latest, prices, days) {
    return prices
        .slice(0, days - 1)
        .reduce((acc, val) => acc + val.price, latest);
}
function ema(latest, prices, days) {
    if (prices.length < days) {
        return null;
    }
    // let smaForPeriod = totalForDays(latest, prices, days) / days;
    let k = 2 / (days + 1);
    let value = prices[prices.length - 1].price;
    for (let i = prices.length - 2; i >= 0; i--) {
        value = value + k * (prices[i].price - value);
    }
    value = value + k * (latest - value);
    return Math.round(value);
}
// TODO This needs the following changes:
// Return a set of TechnicalCalculator objects that are preloaded with averages for the historical data
// and can then return the proper values given today's quote for a symbol.
// These objects should be serializable as well so that they can be calculated in the API and then transferred to the client.
// Move this file into a new package that can be used from both the browser
// and the API.
async function default_1(history, quotes) {
    var _a;
    let output = new Map();
    for (let [symbol, prices] of history.entries()) {
        let latest = ((_a = quotes === null || quotes === void 0 ? void 0 : quotes[symbol]) === null || _a === void 0 ? void 0 : _a.mark) * 100;
        if (date.isToday(prices[0].date) || !latest) {
            latest = prices[0].price;
            prices = prices.slice(1);
        }
        let total50 = totalForDays(latest, prices, 50);
        let total200 = prices
            .slice(49, 199)
            .reduce((acc, val) => acc + val.price, total50);
        let ma50 = Math.round(total50 / 50);
        let ma200 = Math.round(total200 / 200);
        let ema10 = ema(latest, prices, 10);
        let ema21 = ema(latest, prices, 21);
        output.set(symbol, { prices, ema10, ema21, ma50, ma200 });
    }
    return output;
}
exports.default = default_1;
//# sourceMappingURL=technicals.js.map