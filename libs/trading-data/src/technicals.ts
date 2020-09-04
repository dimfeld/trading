import * as _ from 'lodash';
import * as historical from './historical';

function ema(prices : historical.HistoricalPrice[], days: number) {
  if(prices.length < days + 1) {
    return null;
  }

  let smaForPeriod = _.sumBy(prices.slice(0, days), 'price') / days;

  let sf = 2 / (days + 1);
  let value = smaForPeriod;
  for(let i = days - 1; i >= 0; i--) {
    value = value + sf * (prices[i].price - value);
  }
  return Math.round(value);
}

export default async function(symbol : string) {
  let prices = await historical.getPriceHistory(symbol, 200);

  let total50 = _.sumBy(prices.slice(0, 50), 'price');
  let total200 = _.sumBy(prices.slice(50, 200), 'price') + total50;

  let ma50 = Math.round(total50 / 50);
  let ma200 = Math.round(total200 / 200);

  let ema10 = ema(prices, 10);
  let ema21 = ema(prices, 21);

  return { ema10, ema21, ma50, ma200 };
}

