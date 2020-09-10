import * as date from 'date-fns';

function totalForDays(prices, days) {
  return prices.slice(0, days).reduce((acc, val) => acc + val.close, 0);
}

function emaMultiplier(days) {
  return 2 / (days + 1);
}

function ema(prices, days) {
  if (prices.length < days) {
    return null;
  } // let smaForPeriod = totalForDays(latest, prices, days) / days;


  let k = emaMultiplier(days);
  let value = prices[prices.length - 1].close;

  for (let i = prices.length - 1; i >= 0; i--) {
    value = value + k * (prices[i].close - value);
  }

  return Math.round(value);
}

function technicalCalculator(symbol, prices,
/** Exclude the first bar if it's from today. Use for daily bars only */
excludeToday = true) {
  let fullDayToday = excludeToday && date.isToday(prices[0].time);
  let pricesWithoutToday = fullDayToday ? prices.slice(1) : prices;
  let total49 = totalForDays(pricesWithoutToday, 49);
  let total50Yesterday = total49 + pricesWithoutToday[49].close;
  let total199 = pricesWithoutToday.slice(49, 198).reduce((acc, val) => acc + val.close, total49);
  let total200Yesterday = total199 + pricesWithoutToday[199].close;
  let ema9Yesterday = ema(pricesWithoutToday, 9);
  let ema10Yesterday = ema(pricesWithoutToday, 10);
  let ema12Yesterday = ema(pricesWithoutToday, 12);
  let ema21Yesterday = ema(pricesWithoutToday, 21);
  let ema26Yesterday = ema(pricesWithoutToday, 26);
  let ma50Yesterday = total50Yesterday / 50;
  let ma200Yesterday = total200Yesterday / 200; // Bollinger bands calculations

  let total19 = totalForDays(pricesWithoutToday, 20);
  let total20Yesterday = total19 + pricesWithoutToday[19].close;
  let ma20Yesterday = total20Yesterday / 20;
  const numRsiDays = 20;
  let gainsByDay = new Array(numRsiDays);
  let lossesByDay = new Array(numRsiDays);

  for (let i = 0; i < numRsiDays; ++i) {
    let _change = pricesWithoutToday[i].close - pricesWithoutToday[i + 1].close;

    if (_change >= 0) {
      gainsByDay[i] = (gainsByDay[i - 1] || 0) + _change;
      lossesByDay[i] = lossesByDay[i - 1] || 0;
    } else {
      gainsByDay[i] = gainsByDay[i - 1];
      lossesByDay[i] = -_change;
    }
  }

  let gain13 = 0;
  let loss13 = 0;

  for (let i = 0; i < 13; i++) {
    let _change2 = pricesWithoutToday[i].close - pricesWithoutToday[i + 1].close;

    if (_change2 > 0) {
      gain13 += _change2;
    } else if (_change2 < 0) {
      loss13 -= _change2;
    }
  }

  let gain14 = gain13;
  let loss14 = loss13;
  let change = pricesWithoutToday[13].close - pricesWithoutToday[14].close;

  if (change > 0) {
    gain14 += change;
  } else if (change < 0) {
    loss14 += change;
  }

  let gain19 = gain14;
  let loss19 = loss14;

  for (let i = 14; i < 19; i++) {
    let _change3 = pricesWithoutToday[i].close - pricesWithoutToday[i + 1].close;

    if (_change3 > 0) {
      gain19 += _change3;
    } else if (_change3 < 0) {
      loss19 -= _change3;
    }
  }

  let gain20 = gain19;
  let loss20 = loss19;
  change = pricesWithoutToday[19].close - pricesWithoutToday[19].close;

  if (change > 0) {
    gain20 += change;
  } else if (change < 0) {
    loss20 += change;
  }

  function rsi(numDays, gains, losses) {
    let avgGain = gains / numDays;
    let avgLoss = losses / numDays;
    let rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  let rsi20Yesterday = rsi(20, gain20, loss20);
  let rsi14Yesterday = rsi(14, gain14, loss14);

  function variance(initialPrice, avg, limit) {
    let initial = initialPrice ? initialPrice - avg : 0;
    return pricesWithoutToday.slice(0, limit).reduce((acc, val) => {
      let v = val.close - avg;
      return acc + v * v;
    }, initial * initial);
  }

  let variance20Yesterday = variance(0, ma20Yesterday, 20) / 19;
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
    rsi14: rsi14Yesterday,
    rsi20: rsi20Yesterday,
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
    latest *= 100;
    let ma20 = (total19 + latest) / 20;
    let variance20 = variance(latest, ma20, 19) / 19;
    let stddev20 = Math.sqrt(variance20);
    let rsi14;
    let rsi20;
    let change = latest - pricesWithoutToday[0].close;

    if (change > 0) {
      rsi14 = rsi(14, gain13 + change, loss13);
      rsi20 = rsi(20, gain19 + change, loss19);
    } else {
      rsi14 = rsi(14, gain13, loss13 - change);
      rsi20 = rsi(20, gain19, loss19 - change);
    }

    return {
      symbol,
      prices,
      fullDayToday,
      yesterday,
      latest,
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
    prices,
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


export function createTechnicalCalculators(history) {
  let output = new Map();

  for (let [symbol, prices] of history.entries()) {
    let calc = technicalCalculator(symbol, prices);
    output.set(symbol, calc);
  }

  return output;
}
//# sourceMappingURL=technicals.js.map