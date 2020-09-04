const parse = require('csv-parse/lib/sync');
import * as _ from 'lodash';
import * as hyperid_factory from 'hyperid';

import { ITrade, UnderlyingWithTrade } from '../types';

const hyperid = hyperid_factory({ urlSafe: true });

function to_number(x : string) {
  return +(x.replace(/,/g, ''));
}

export function get_trades(lines : string) : UnderlyingWithTrade[] {
  let data = parse(lines, { columns: true });

  return _.map(data, (trade) => {
    let price = to_number(trade['Average Price'])  / to_number(trade.Multiplier);
    let bought = trade.Action.startsWith('BUY');
    let output_trade = {
      id: hyperid(),
      note: trade.Description,
      traded: trade.Date,
      tags: [],
      gross: to_number(trade.Value),
      commissions: -(to_number(trade.Commissions) + to_number(trade.Fees)),
      legs: [
        {
          symbol: trade.Symbol,
          size: bought ? to_number(trade.Quantity) : -to_number(trade.Quantity),
        },
      ],
    };

    return {
      trade: output_trade,
      underlying: trade['Underlying Symbol'],
    };
  });
}
