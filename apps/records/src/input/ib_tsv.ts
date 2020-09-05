import * as _ from 'lodash';
import { DbTrade } from 'types';
import { fullSymbol } from 'options-analysis';
import { lcm } from './gcd';
import * as stripAnsi from 'strip-ansi';
import { UnderlyingWithTrade, describe_sorted_legs } from '../ui';

function parse_line(s: string) {
  let columns = s.split('\t');
  if (columns.length <= 1) {
    return;
  }

  let bought = columns[2] === 'BOT';
  let quantity = +columns[3];
  let underlying = columns[4];
  let price = +columns[6];
  let expiration = columns[9];
  let strike = +columns[10];
  let time = columns[11];
  let trade_id = columns[12].split('.')[0];
  let commissions = +columns[14];
  let option_type = _.toUpper(columns[15]);

  let needs_date = /^(\d{2}):(\d{2}):(\d{2})$/.exec(time);
  let trade_date: Date;
  if (needs_date) {
    trade_date = new Date();
    trade_date.setHours(+needs_date[1]);
    trade_date.setMinutes(+needs_date[2]);
    trade_date.setSeconds(+needs_date[3]);
  } else {
    trade_date = new Date(time);
    let now = new Date();
    if (trade_date.getUTCFullYear() < now.getUTCFullYear()) {
      trade_date.setUTCFullYear(now.getUTCFullYear());
    }
  }

  if (expiration.slice(0, 2) === '20') {
    expiration = expiration.slice(2);
  }

  return {
    line: s,
    trade_id,
    date: trade_date,
    bought,
    quantity,
    symbol: underlying,
    expiration,
    strike: +strike,
    option_type,
    price,
    commissions,
  };
}

function consolidate_legs(
  parsed: Array<ReturnType<typeof parse_line>>,
  trade_id
): UnderlyingWithTrade {
  let trade: DbTrade = {
    id: trade_id,
    commissions: 0,
    gross: 0,
    price_each: 0,
    legs: [],
    tags: [],
    traded: '',
  };

  let trade_date: Date;
  _.each(parsed, (p) => {
    if (!trade_date || p.date.getTime() > trade_date.getTime()) {
      trade_date = p.date;
    }

    let leg_info = {
      underlying: p.symbol,
      strike: p.strike,
      call: p.option_type === 'CALL',
      expiration: p.expiration,
    };

    let occ_symbol = fullSymbol(leg_info);
    let leg_object = _.find(trade.legs, (l) => l.symbol === occ_symbol);
    let size = p.bought ? p.quantity : -p.quantity;
    if (leg_object) {
      leg_object.size += size;
    } else {
      trade.legs.push({ symbol: occ_symbol, size: size, price: p.price });
    }

    trade.commissions += p.commissions;

    let amount = p.price * -size;
    if (p.option_type) {
      amount *= 100;
    }
    trade.gross += amount;
  });

  trade.traded = trade_date.toUTCString();

  let legs_desc = stripAnsi(describe_sorted_legs(trade.legs).join(', ').trim());
  trade.note = `${parsed[0].symbol} ${legs_desc}`;

  return {
    underlying: parsed[0].symbol,
    trade,
  };
}

export function get_trades(buffer: string) {
  return _.chain(buffer)
    .split('\n')
    .filter((s) => !s.startsWith('-'))
    .map(parse_line)
    .compact()
    .groupBy((x) => `${x.symbol}:${x.trade_id}`)
    .map(consolidate_legs)
    .value();
}
