import * as _ from 'lodash';
import { HistoricalPrice } from './historical';
import { Quote } from 'types';
import * as date from 'date-fns';

function totalForDays(latest: number, prices: HistoricalPrice[], days: number) {
  return prices
    .slice(0, days - 1)
    .reduce((acc, val) => acc + val.price, latest);
}

function ema(latest: number, prices: HistoricalPrice[], days: number) {
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

export interface Technicals {
  prices: HistoricalPrice[];
  ema10: number;
  ema21: number;
  ma50: number;
  ma200: number;
}

// TODO This needs the following changes:
// Return a set of TechnicalCalculator objects that are preloaded with averages for the historical data
// and can then return the proper values given today's quote for a symbol.
// These objects should be serializable as well so that they can be calculated in the API and then transferred to the client.
// Move this file into a new package that can be used from both the browser
// and the API.

export default async function (
  history: Map<string, HistoricalPrice[]>,
  quotes?: { [symbol: string]: Quote }
) {
  let output = new Map<string, Technicals>();
  for (let [symbol, prices] of history.entries()) {
    let latest = quotes?.[symbol]?.mark * 100;

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
