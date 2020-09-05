import * as _ from 'lodash';
import * as makeDebug from 'debug';

import { analyzeLiquidity } from 'options-analysis';

import { OptionChain, StrikeMap, ExpirationDateMap } from 'types';
import { Config } from './config';

const debug = makeDebug('analyze');

class ResultDedup {
  seen = {};

  add(strike, dte) {
    let seen = _.get(this.seen, [strike, dte]);
    if (seen) {
      return false;
    }

    _.set(this.seen, [strike, dte], true);
    return true;
  }
}

interface FormatInput extends ReturnType<typeof analyzeLiquidity> {
  line?: string;
  underlying: {
    last: number;
    change: number;
    percentChange: number;
    highPrice: number;
    lowPrice: number;
  };
}

export function format_json(result: FormatInput) {
  let dd = new ResultDedup();
  return _.map(result.results, (r) => {
    if (!dd.add(r.strikePrice, r.daysToExpiration)) {
      return '';
    }

    return (
      JSON.stringify({
        ...r,
        contract_symbol: r.symbol,
        symbol: result.symbol,
      }) + '\n'
    );
  }).join('');
}

export function format_text(result: FormatInput) {
  let dd = new ResultDedup();
  let header = result.line ? result.line : _.padEnd(result.symbol, 5, ' ');
  let output = _.chain(result.results)
    .map((r) => {
      if (!dd.add(r.strikePrice, r.daysToExpiration)) {
        return '';
      }

      let type = r.putCall === 'CALL' ? 'C' : 'P';
      return `${type} $${_.padEnd(r.strikePrice.toString(), 5, ' ')} ${
        r.expiration
      } D:${Math.round(Math.abs(r.delta) * 100)} for ${r.targetDelta * 100} V:${
        r.totalVolume
      } OI:${r.openInterest} BA:${r.bid}-${r.ask} (${r.spreadPercent.toFixed(
        1
      )}%)`;
    })
    .compact()
    .value();

  if (!output.length) {
    return '';
  }

  let un = result.underlying;
  let sign = un.change >= 0 ? '+' : '';
  output.unshift(
    `Current: ${un.last} (${sign}${un.change}  ${un.percentChange.toFixed(
      2
    )}%) H:${un.highPrice} L:${un.lowPrice}`
  );

  let separator = '\n  ';
  return header.trim() + separator + output.join(separator) + '\n\n';
}
