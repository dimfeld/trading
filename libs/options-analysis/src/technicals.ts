import * as _ from 'lodash';
import { Bar } from 'types';
import * as date from 'date-fns';

const MA_LENGTH = 50;

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

export function ema(
  prices: number[],
  days: number,
  maxLength = MA_LENGTH
): number[] {
  if (prices.length < days) {
    return null;
  }

  // let smaForPeriod = totalForDays(prices, days) / days;

  let k = emaMultiplier(days);
  let maxDate = Math.min(250, prices.length - 1);
  let values = new Array(maxDate + 1);
  values[maxDate] = prices[maxDate];
  for (let i = maxDate - 1; i >= 0; i--) {
    values[i] = values[i + 1] + k * (prices[i] - values[i + 1]);
  }

  return values.slice(0, maxLength);
}

export interface PreviousTechnicals {
  ma50: number[];
  ma200: number[];
  ema9: number[];
  ema10: number[];
  ema12: number[];
  ema21: number[];
  ema26: number[];
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

export interface LatestTechnicals {
  symbol: string;
  prices: Bar[];
  fullDayToday: boolean;
  previous: PreviousTechnicals;
  latest: number;

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

export interface TechnicalCalculator {
  symbol: string;
  prices: Bar[];
  fullDayToday: boolean;
  previous: PreviousTechnicals;
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

  let firstTotal49 = totalForDays(pricesWithoutToday, 49);
  let total50 = firstTotal49 + pricesWithoutToday[49];
  let firstTotal199 = total50 + totalForDays(pricesWithoutToday.slice(50), 149);
  let total200 = firstTotal199 + pricesWithoutToday[199];

  let ma50 = new Array(Math.max(Math.min(MA_LENGTH, bars.length - 50), 1));
  let ma200 = new Array(Math.max(Math.min(MA_LENGTH, bars.length - 200), 1));

  ma50[0] = total50 / 50;
  for (let i = 1; i < ma50.length; ++i) {
    total50 = total50 - pricesWithoutToday[i - 1] + pricesWithoutToday[49 + i];
    ma50[i] = total50 / 50;
  }

  ma200[0] = total200 / 200;
  for (let i = 1; i < ma200.length; ++i) {
    total200 =
      total200 - pricesWithoutToday[i - 1] + pricesWithoutToday[199 + i];
    ma200[i] = total200 / 200;
  }

  let ema5Yesterday = ema(pricesWithoutToday, 5);
  let ema9Yesterday = ema(pricesWithoutToday, 9);
  let ema10Yesterday = ema(pricesWithoutToday, 10);
  let ema12Yesterday = ema(pricesWithoutToday, 12);
  let ema21Yesterday = ema(pricesWithoutToday, 21);
  let ema26Yesterday = ema(pricesWithoutToday, 26);

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

  let previous = {
    prices: pricesWithoutToday,
    ema5: ema5Yesterday,
    ema9: ema9Yesterday,
    ema10: ema10Yesterday,
    ema12: ema12Yesterday,
    ema21: ema21Yesterday,
    ema26: ema26Yesterday,
    ma50,
    ma200,
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
      previous,
      latest,
      ma20,
      ma50: (firstTotal49 + latest) / 50,
      ma200: (firstTotal199 + latest) / 200,
      ema5: ema5Yesterday[0] + emaMultiplier(5) * (latest - ema5Yesterday[0]),
      ema9: ema9Yesterday[0] + emaMultiplier(9) * (latest - ema9Yesterday[0]),
      ema10:
        ema10Yesterday[0] + emaMultiplier(10) * (latest - ema10Yesterday[0]),
      ema12:
        ema12Yesterday[0] + emaMultiplier(12) * (latest - ema12Yesterday[0]),
      ema21:
        ema21Yesterday[0] + emaMultiplier(21) * (latest - ema21Yesterday[0]),
      ema26:
        ema26Yesterday[0] + emaMultiplier(26) * (latest - ema26Yesterday[0]),
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
    previous,
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
