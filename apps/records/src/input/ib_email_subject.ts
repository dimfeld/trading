import * as _ from 'lodash';
import * as analysis from 'options-analysis';
import * as hyperid_factory from 'hyperid';
import * as debug_factory from 'debug'
import { IPosition, ITrade, IOptionLeg, DbData } from '../types';
import { resolve_combo } from '../resolve_combo';

const debug = debug_factory('ib_email_subject');
const hyperid = hyperid_factory({ urlSafe: true });

const subject_re = /Subject: ((BOUGHT|SOLD) ([\d,]+) (\S+) (?:PINK )?(?:(\S+) ([\d.]+) (\S+) )?@ ([\d.]+))/;
const date_re = /^Date: (.*)$/m;

export function parse_subject(s : string) {
  debug(s);
  let m = subject_re.exec(s);
  if(!m) {
    if(s.indexOf('Subject:') < 0) {
      return null;
    }
    throw new Error("Failed to parse " + s);
  }

  let [ , line, transaction_type, quantity, symbol, expiration, strike, option_type, price ] = m;

  let date_match = date_re.exec(s);
  if(!date_match) {
    throw new Error("Couldn't find date!");
  }

  // Combo executions don't have much data.
  let combo = symbol.endsWith('-COMB');
  if(combo) {
    symbol = symbol.slice(0, -('-COMB'.length));
    option_type = 'COMBO';
  }

  let size = +quantity.replace(/,/g, '');

  return {
    line,
    date: new Date(date_match[1]),
    bought: transaction_type === 'BOUGHT',
    quantity: size,
    symbol,
    expiration: new Date(expiration),
    strike: +strike,
    option_type,
    price: +price,
  };
}

interface TradeWithPrice extends ITrade {
  price_each : number;
}

export async function get_trades(input : string, db_data : DbData) {
  let trades = _.chain(input)
    .split('From TradingAssistant')
    .map((x) => x.trim())
    .filter(((x) => x.indexOf('Subject:') >= 0))
    .map((line) => {
      let parsed = parse_subject(line);
      debug(parsed);

      let legs : IOptionLeg[] = [];
      let combo_info;
      let multiplier = parsed.bought ? 1 : -1;
      let option_trade = Boolean(parsed.option_type);
      if(!option_trade) {
        legs.push({
          symbol: parsed.symbol,
          size: parsed.quantity * multiplier,
        });
      } else if(parsed.option_type !== 'COMBO') {
        let expiration = analysis.occExpirationFromDate(parsed.expiration);
        let symbol = analysis.fullSymbol({
          underlying: parsed.symbol,
          call: parsed.option_type === 'CALL',
          strike: parsed.strike,
          expiration,
        });

        legs.push({
          symbol,
          size: parsed.quantity * multiplier,
        });
      }

      let price_each = parsed.price * -multiplier;
      let gross = parsed.quantity * price_each;
      if(option_trade) {
        gross *= 100;
      }

      let trade : TradeWithPrice = {
        id: hyperid(),
        note: parsed.line,
        tags: [],
        price_each,
        gross,
        commissions: null,
        traded: parsed.date.toISOString(),
        legs,
      };

      debug(trade);

      return {
        underlying: parsed.symbol,
        size: parsed.quantity * multiplier,
        trade,
      };
    })
    .sortBy('trade.date')
    .value();

  for(let t of trades) {
    if(!t.trade.legs.length) {
      debug("Resolving combo for", t);
      t.trade.legs = await resolve_combo(t.underlying, t.size, t.trade.price_each, t.trade.traded, db_data);
      debug("Got", t.trade.legs);
    }
  }

  return trades;
}
