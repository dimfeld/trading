import * as _ from 'lodash';
import { Bar } from 'types';
import * as date from 'date-fns';

function totalForDays(prices: number[], days: number) {
  let result = 0;
  for (let i = 0; i < days; i += 1) {
    result += prices[i];
  }
  return result;
}

function emaMultiplier(days: number) {
  return 2 / (days + 1);
}

function ema(prices: number[], days: number) {
  if (prices.length < days) {
    return null;
  }

  // let smaForPeriod = totalForDays(prices, days) / days;

  let k = emaMultiplier(days);
  let maxDate = Math.min(250, prices.length - 1);
  let value = prices[maxDate];
  for (let i = maxDate - 1; i >= 0; i--) {
    value = value + k * (prices[i] - value);
  }

  return value;
}

export interface Technicals {
  ma50: number;
  ma200: number;
  ema9: number;
  ema10: number;
  ema12: number;
  ema21: number;
  ema26: number;
  rsi14: number;
  rsi20: number;
  bollinger: {
    upper1SD: number;
    lower1SD: number;
    upper2SD: number;
    lower2SD: number;
    upper3SD: number;
    lower3SD: number;
  };
}

export interface LatestTechnicals extends Technicals {
  symbol: string;
  prices: Bar[];
  fullDayToday: boolean;
  yesterday: Technicals;
  latest: number;
}

export interface TechnicalCalculator {
  symbol: string;
  prices: Bar[];
  fullDayToday: boolean;
  yesterday: Technicals;
  latest(latestPrice: number): LatestTechnicals;
}

export function technicalCalculator(
  symbol: string,
  bars: Bar[],
  /** Exclude the first bar if it's from today. Use for daily bars only */
  excludeToday = true
): TechnicalCalculator {
  let prices = bars.map((b) => b.close /*(b.open + b.close) / 2*/);
  let fullDayToday = excludeToday && date.isToday(bars[0].time);
  let pricesWithoutToday = fullDayToday ? prices.slice(1) : prices;

  let total49 = totalForDays(pricesWithoutToday, 49);
  let total50Yesterday = total49 + pricesWithoutToday[49];

  let total199 = pricesWithoutToday
    .slice(50, 199)
    .reduce((acc, val) => acc + val, total50Yesterday);

  let total200Yesterday = total199 + pricesWithoutToday[199];

  let ema9Yesterday = ema(pricesWithoutToday, 9);
  let ema10Yesterday = ema(pricesWithoutToday, 10);
  let ema12Yesterday = ema(pricesWithoutToday, 12);
  let ema21Yesterday = ema(pricesWithoutToday, 21);
  let ema26Yesterday = ema(pricesWithoutToday, 26);
  let ma50Yesterday = total50Yesterday / 50;
  let ma200Yesterday = total200Yesterday / 200;

  // Bollinger bands calculations
  let total19 = totalForDays(pricesWithoutToday, 19);

  let total20Yesterday = total19 + pricesWithoutToday[19];
  let ma20Yesterday = total20Yesterday / 20;

  const lastRsiDay = Math.min(250, pricesWithoutToday.length - 2);
  const numRsiDays = 20;
  // These start from the end of the series.
  let gainsByDay = new Array(numRsiDays);
  let lossesByDay = new Array(numRsiDays);

  for (let i = 0; i < numRsiDays; ++i) {
    let priceIndex = lastRsiDay - i;
    let change =
      pricesWithoutToday[priceIndex] - pricesWithoutToday[priceIndex + 1];
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
  let avgLoss14 = lossesByDay[13] / 14;
  let avgGain20 = gainsByDay[19] / 20;
  let avgLoss20 = lossesByDay[19] / 20;

  for (let i = lastRsiDay - numRsiDays - 1; i >= 0; --i) {
    let change = pricesWithoutToday[i] - pricesWithoutToday[i + 1];
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
      lower3SD: ma20Yesterday - stddev20Yesterday * 3,
    },
  };

  function calculateLatest(latest: number) {
    let ma20 = (total19 + latest) / 20;
    let variance20 = variance(latest, ma20, 19) / 20;
    let stddev20 = Math.sqrt(variance20);

    let rsi14;
    let rsi20;
    let change = latest - pricesWithoutToday[0];
    if (change > 0) {
      rsi14 = rsi(avgGain14 * 13 + change, avgLoss14 * 13);
      rsi20 = rsi(avgGain20 * 19 + change, avgLoss20 * 19);
    } else {
      rsi14 = rsi(avgGain14 * 13, avgLoss14 * 13 - change);
      rsi20 = rsi(avgGain20 * 19, avgLoss20 * 19 - change);
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
        lower3SD: ma20 - stddev20 * 3,
      },
    };
  }

  return {
    symbol,
    prices: bars,
    fullDayToday,
    yesterday,
    latest: calculateLatest,
  };
}

export function createTechnicalCalculators(history: Map<string, Bar[]>) {
  let output = new Map<string, TechnicalCalculator>();
  for (let [symbol, prices] of history.entries()) {
    let calc = technicalCalculator(symbol, prices);
    output.set(symbol, calc);
  }

  return output;
}
