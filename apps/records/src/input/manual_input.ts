import * as inquirer from 'inquirer';
import * as hyperidMod from 'hyperid';
import * as moment from 'moment';
import { DbTrade } from 'types';
import { UnderlyingWithTrade } from '../ui';

const hyperid = hyperidMod({ urlSafe: true });

export async function get_trades() {
  let trades: UnderlyingWithTrade[] = [];

  let today = moment().format('YYYY-MM-DD');

  console.log('Equities only for now!');
  while (true) {
    interface Data {
      symbol: string;
      size: string;
      price: string;
      date: string;
      another: boolean;
    }

    let data = await inquirer.prompt<Data>([
      { type: 'input', name: 'symbol', message: 'Symbol' },
      { type: 'input', name: 'size', message: 'Size' },
      { type: 'input', name: 'price', message: 'Price' },
      { type: 'input', name: 'date', message: 'Trade Date', default: today },
      { type: 'confirm', name: 'another', message: 'Enter Another Trade' },
    ]);

    let price = +data.price;
    let size = +data.size;

    let bought = size > 0;

    let t: DbTrade = {
      id: hyperid(),
      commissions: 0,
      gross: -size * price,
      traded: new Date(data.date).toISOString(),
      tags: [],
      price_each: price,
      legs: [{ symbol: data.symbol, size, price }],
    };

    trades.push({ underlying: data.symbol, broker: null, trade: t });

    if (!data.another) {
      break;
    }
  }

  return trades;
}
