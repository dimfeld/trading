import * as _ from 'lodash';
import * as hyperid_factory from 'hyperid';
import { DbPosition, DbOptionLeg } from 'types';
import { PositionChange } from '../ui';
import * as analyze from 'options-analysis';

const hyperid = hyperid_factory({ urlSafe: true });

export function check_expired_legs(positions: DbPosition[]) {
  let updated_positions: PositionChange[] = [];

  let today = analyze.occExpirationFromDate(new Date());
  _.each(positions, (position) => {
    let [valid_legs, expired_legs] = _.partition(position.legs, (leg) => {
      let info = analyze.optionInfoFromLeg(leg);
      return !info.expiration || today < info.expiration;
    });

    if (expired_legs.length) {
      let max_expiration = '000000';
      for (let leg of expired_legs) {
        let info = analyze.optionInfoFromLeg(leg);
        max_expiration =
          info.expiration > max_expiration ? info.expiration : max_expiration;
      }

      let expiration_date = analyze.dateFromOccExpiration(max_expiration);

      if (valid_legs.length === 0) {
        position.close_date = expiration_date;
      }
      position.legs = valid_legs;

      let trade = {
        gross: 0,
        id: hyperid(),
        legs: _.map(expired_legs, (leg) => {
          return {
            symbol: leg.symbol,
            size: -leg.size,
            price: 0,
          };
        }),
        price_each: 0,
        note: 'Options Expired',
        traded: expiration_date.toISOString(),
        tags: null,
        commissions: 0,
      };

      position.trades.push(trade);

      let tp: PositionChange = {
        position,
        trade,
        change: analyze.Change.Closed,
      };

      updated_positions.push(tp);
    }
  });

  return updated_positions;
}
