import * as _ from 'lodash';
import * as analysis from 'options-analysis';
import { uid } from 'uid';
import debug_factory from 'debug';
import { DbTrade, DbOptionTradeLeg } from 'types';
import { gcd } from './gcd';
import * as cheerio from 'cheerio';

const debug = debug_factory('tastyworks_email');

const trade_re = /(Bought|Sold) (\d+) (\S+) (?:(\S+) (\S+) ([\d.]+) )?@ ([\d.]+)/;

export function parse_email(s: string) {
  debug(s.slice(0, 100));
  let html_start = s.indexOf('<div');

  if (html_start < 0) {
    return null;
  }

  s = s.slice(html_start);
  debug(s.slice(0, 100));

  let $ = cheerio.load(s);
  let trade_date = $(
    'div > table > tbody > tr:nth-child(1) > td:nth-child(2)'
  ).text();
  let trade_symbol = $(
    'div > table > tbody > tr:nth-child(2) > td:nth-child(2)'
  ).text();

  let leg_html = $('div > ul > li')
    .map((i, el) => $(el).text())
    .get();
  debug('leg html', leg_html);

  let legs = _.map(leg_html, (leg_text) => {
    let m = trade_re.exec(leg_text);
    if (!m) {
      throw new Error('Failed to parse ' + leg_text);
    }

    let [
      ,
      transaction_type,
      quantity,
      symbol,
      expiration,
      option_type,
      strike,
      price,
    ] = m;
    return {
      bought: transaction_type === 'Bought',
      quantity: +quantity,
      symbol,
      expiration: new Date(expiration),
      strike: +strike,
      option_type,
      price: +price,
    };
  });

  return {
    symbol: trade_symbol,
    date: new Date(trade_date),
    legs,
  };
}

export function get_trades(input: string) {
  return _.chain(input)
    .split(/From:/)
    .map(parse_email)
    .compact()
    .sortBy('date')
    .map((parsed) => {
      debug(parsed);

      let sizes = _.map(parsed.legs, (p) => Math.abs(p.quantity));
      let trade_size = gcd(sizes);

      let gross = 0;
      let options_trade = false;
      let legs: DbOptionTradeLeg[] = _.map(parsed.legs, (p) => {
        let multiplier = p.bought ? 1 : -1;
        gross += p.price * p.quantity * -multiplier;
        let symbol;
        if (p.option_type) {
          options_trade = true;
          let expiration = analysis.occExpirationFromDate(p.expiration);
          symbol = analysis.fullSymbol({
            underlying: p.symbol,
            call: _.toLower(p.option_type) === 'call',
            strike: p.strike,
            expiration,
          });
        } else {
          symbol = p.symbol;
        }

        return {
          symbol,
          size: p.quantity * multiplier,
          price: p.price,
        };
      });

      let price_each = gross / trade_size;
      if (options_trade) {
        gross *= 100;
      }

      let trade: DbTrade = {
        id: uid(),
        note: null,
        tags: [],
        gross,
        commissions: null,
        price_each,
        traded: parsed.date.toISOString(),
        legs,
      };

      debug(trade);

      return {
        underlying: parsed.symbol,
        broker: null,
        trade,
      };
    })
    .value();
}
