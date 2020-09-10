"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.technicalCalculator = technicalCalculator;
exports.createTechnicalCalculators = createTechnicalCalculators;

var date = _interopRequireWildcard(require("date-fns"));

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function totalForDays(prices, days) {
  let result = 0;

  for (let i = 0; i < days; i += 1) {
    result += prices[i];
  }

  return result;
}

function emaMultiplier(days) {
  return 2 / (days + 1);
}

function ema(prices, days) {
  if (prices.length < days) {
    return null;
  } // let smaForPeriod = totalForDays(prices, days) / days;


  let k = emaMultiplier(days);
  let maxDate = Math.min(250, prices.length - 1);
  let value = prices[maxDate];

  for (let i = maxDate - 1; i >= 0; i--) {
    value = value + k * (prices[i] - value);
  }

  return value;
}

function technicalCalculator(symbol, bars,
/** Exclude the first bar if it's from today. Use for daily bars only */
excludeToday = true) {
  let prices = bars.map(b => b.close
  /*(b.open + b.close) / 2*/
  );
  let fullDayToday = excludeToday && date.isToday(bars[0].time);
  let pricesWithoutToday = fullDayToday ? prices.slice(1) : prices;
  let total49 = totalForDays(pricesWithoutToday, 49);
  let total50Yesterday = total49 + pricesWithoutToday[49];
  let total199 = pricesWithoutToday.slice(50, 199).reduce((acc, val) => acc + val, total50Yesterday);
  let total200Yesterday = total199 + pricesWithoutToday[199];
  let ema9Yesterday = ema(pricesWithoutToday, 9);
  let ema10Yesterday = ema(pricesWithoutToday, 10);
  let ema12Yesterday = ema(pricesWithoutToday, 12);
  let ema21Yesterday = ema(pricesWithoutToday, 21);
  let ema26Yesterday = ema(pricesWithoutToday, 26);
  let ma50Yesterday = total50Yesterday / 50;
  let ma200Yesterday = total200Yesterday / 200; // Bollinger bands calculations

  let total19 = totalForDays(pricesWithoutToday, 19);
  let total20Yesterday = total19 + pricesWithoutToday[19];
  let ma20Yesterday = total20Yesterday / 20;
  const lastRsiDay = Math.min(250, prices.length - 2);
  const numRsiDays = 20; // These start from the end of the series.

  let gainsByDay = new Array(numRsiDays);
  let lossesByDay = new Array(numRsiDays);

  for (let i = 0; i < numRsiDays; ++i) {
    let priceIndex = lastRsiDay - i;
    let change = pricesWithoutToday[priceIndex] - pricesWithoutToday[priceIndex + 1];

    if (change >= 0) {
      gainsByDay[i] = (gainsByDay[i - 1] || 0) + change;
      lossesByDay[i] = lossesByDay[i - 1] || 0;
    } else {
      gainsByDay[i] = gainsByDay[i - 1];
      lossesByDay[i] = (lossesByDay[i - 1] || 0) - change;
    }
  }

  function rsi(avgGain, avgLoss) {
    return 100 - 100 / (1 + avgGain / avgLoss);
  }

  let avgGain14 = gainsByDay[13] / 14;
  let avgLoss14 = gainsByDay[13] / 14;
  let avgGain20 = gainsByDay[19] / 20;
  let avgLoss20 = gainsByDay[19] / 20;

  for (let i = lastRsiDay - numRsiDays; i >= 0; --i) {
    let change = prices[i] - prices[i - 1];
    let gain;
    let loss;

    if (change > 0) {
      gain = change;
      loss = 0;
    } else {
      gain = 0;
      loss = change;
    }

    avgGain14 = (avgGain14 * 13 + gain) / 14;
    avgLoss14 = (avgLoss14 * 13 - loss) / 14;
    avgGain20 = (avgGain20 * 19 + gain) / 20;
    avgLoss20 = (avgLoss20 * 19 - loss) / 20;
  }

  function variance(initialPrice, avg, limit) {
    let initial = initialPrice ? initialPrice - avg : 0;
    return pricesWithoutToday.slice(0, limit).reduce((acc, val) => {
      let v = val - avg;
      return acc + v * v;
    }, initial * initial);
  }

  let variance20Yesterday = variance(0, ma20Yesterday, 20) / 20;
  let stddev20Yesterday = Math.sqrt(variance20Yesterday);
  let yesterday = {
    prices: pricesWithoutToday,
    ema9: ema9Yesterday,
    ema10: ema10Yesterday,
    ema12: ema12Yesterday,
    ema21: ema21Yesterday,
    ema26: ema26Yesterday,
    ma50: ma50Yesterday,
    ma200: ma200Yesterday,
    rsi14: rsi(avgGain14, avgLoss14),
    rsi20: rsi(avgGain20, avgLoss20),
    bollinger: {
      upper1SD: ma20Yesterday + stddev20Yesterday,
      lower1SD: ma20Yesterday - stddev20Yesterday,
      upper2SD: ma20Yesterday + stddev20Yesterday * 2,
      lower2SD: ma20Yesterday - stddev20Yesterday * 2,
      upper3SD: ma20Yesterday + stddev20Yesterday * 3,
      lower3SD: ma20Yesterday - stddev20Yesterday * 3
    }
  };

  function calculateLatest(latest) {
    let ma20 = (total19 + latest) / 20;
    let variance20 = variance(latest, ma20, 19) / 20;
    let stddev20 = Math.sqrt(variance20);
    let rsi14;
    let rsi20;
    let change = latest - pricesWithoutToday[0];

    if (change > 0) {
      rsi14 = rsi((avgGain14 * 13 + change) / 14, avgLoss14);
      rsi20 = rsi((avgGain20 * 19 + change) / 20, avgLoss20);
    } else {
      rsi14 = rsi(avgGain14, (avgLoss14 * 13 - change) / 14);
      rsi20 = rsi(avgGain20, (avgLoss20 * 19 - change) / 20);
    }

    return {
      symbol,
      prices: bars,
      fullDayToday,
      yesterday,
      latest,
      ma20,
      ma50: (total49 + latest) / 50,
      ma200: (total199 + latest) / 200,
      ema9: ema9Yesterday + emaMultiplier(9) * (latest - ema9Yesterday),
      ema10: ema10Yesterday + emaMultiplier(10) * (latest - ema10Yesterday),
      ema12: ema12Yesterday + emaMultiplier(12) * (latest - ema12Yesterday),
      ema21: ema21Yesterday + emaMultiplier(21) * (latest - ema21Yesterday),
      ema26: ema26Yesterday + emaMultiplier(26) * (latest - ema26Yesterday),
      rsi14,
      rsi20,
      bollinger: {
        upper1SD: ma20 + stddev20,
        lower1SD: ma20 - stddev20,
        upper2SD: ma20 + stddev20 * 2,
        lower2SD: ma20 - stddev20 * 2,
        upper3SD: ma20 + stddev20 * 3,
        lower3SD: ma20 - stddev20 * 3
      }
    };
  }

  return {
    symbol,
    prices: bars,
    fullDayToday,
    yesterday,
    latest: calculateLatest
  };
} // TODO This needs the following changes:
// Return a set of TechnicalCalculator objects that are preloaded with averages for the historical data
// and can then return the proper values given today's quote for a symbol.
// These objects should be serializable as well so that they can be calculated in the API and then transferred to the client.
// Move this file into a new package that can be used from both the browser
// and the API.


function createTechnicalCalculators(history) {
  let output = new Map();

  for (let [symbol, prices] of history.entries()) {
    let calc = technicalCalculator(symbol, prices);
    output.set(symbol, calc);
  }

  return output;
}
//# sourceMappingURL=technicals.js.map