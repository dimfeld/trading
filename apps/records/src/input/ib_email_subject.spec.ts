/* tslint:disable no-implicit-dependencies */
import * as _ from 'lodash';
import { assert } from 'chai';
import { get_trades, parse_subject } from './ib_email_subject';

describe('ib_email_subject', function() {
  it('parse_subject', function() {
    let tests = [
      {
        input: `SOLD 1 ANET Jun15'18 260 CALL @ 4.3(UXXX1111)`,
        expected: {
          bought: false,
          quantity: 1,
          symbol: 'ANET',
          expiration: new Date(2018, 5, 15),
          strike: 260,
          option_type: 'CALL',
          price: 4.3,
        },
      },
      {
        input: `BOUGHT 4 CPRT Jun15'18 55 PUT @ 1.45 (UXXX1111)`,
        expected: {
          bought: true,
          quantity: 4,
          symbol: 'CPRT',
          expiration: new Date(2018, 5, 15),
          strike: 55,
          option_type: 'PUT',
          price: 1.45,
        },
      },
      {
        input: `SOLD 1 ADSK May25'18 139 CALL @ 4.95 (UXXX1111)`,
        expected: {
          bought: false,
          quantity: 1,
          symbol: 'ADSK',
          expiration: new Date(2018, 4, 25),
          strike: 139,
          option_type: 'CALL',
          price: 4.95,
        },
      },
      {
        input: `SOLD 13 LB Mar16'18 50 CALL @ 2.2 (UXXX1111)`,
        expected: {
          bought: false,
          quantity: 13,
          symbol: 'LB',
          expiration: new Date(2018, 2, 16),
          strike: 50,
          option_type: 'CALL',
          price: 2.2,
        },
      },
      {
        input: `SOLD 17 GME-COMB @ 1.2 (UXXX1111)`,
        expected: {
          bought: false,
          quantity: 17,
          symbol: 'GME',
          expiration: new Date('invalid'),
          strike: NaN,
          option_type: 'COMBO',
          price: 1.2,
        },
      },
      {
        input: `BOUGHT 3 PAYX Apr20'18 67.5 CALL @ 1.45 (UXXX1111)`,
        expected: {
          bought: true,
          quantity: 3,
          symbol: 'PAYX',
          expiration: new Date(2018, 3, 20),
          strike: 67.5,
          option_type: 'CALL',
          price: 1.45,
        },
      },
    ];

    _.each(tests, (test) => {
      let result = parse_subject(test.input);
      assert.deepEqual(result, test.expected, test.input);
    });

  });

  it('get_trades', async function() {
    let input = `BOUGHT 3 PAYX Apr20'18 67.5 CALL @ 1.45 (UXXX1111)
      BOUGHT 4 CPRT Jun15'18 55 PUT @ 1.45 (UXXX1111)
      SOLD 1 ADSK May25'18 139 CALL @ 4.95 (UXXX1111)`;

    let expected = [
      {
        "trade": {
          "commissions": null,
          "gross": -435,
          note: `BOUGHT 3 PAYX Apr20'18 67.5 CALL @ 1.45 (UXXX1111)`,
          "legs": [
            {
              "size": 3,
              "symbol": "PAYX  180420C00067500"
            }
          ],
          "price_each": -1.45,
          "tags": [],
        },
        "underlying": "PAYX"
      },
      {
        "trade": {
          "commissions": null,
          "gross": -580,
          note: `BOUGHT 4 CPRT Jun15'18 55 PUT @ 1.45 (UXXX1111)`,
          "legs": [
            {
              "size": 4,
              "symbol": "CPRT  180615P00055000",
            },
          ],
          "price_each": -1.45,
          "tags": [],
        },
        "underlying": "CPRT",
      },
      {
        "trade": {
          "commissions": null,
          "gross": 495,
          note: `SOLD 1 ADSK May25'18 139 CALL @ 4.95 (UXXX1111)`,
          "legs": [
            {
              "size": -1,
              "symbol": "ADSK  180525C00139000",
            },
          ],
          "price_each": 4.95,
          "tags": [],
        },
        "underlying": "ADSK",
      },
    ];

    let result = await get_trades(input);
    let check_results = _.map(result, (x) => {
      return {
        underlying: x.underlying,
        trade: _.omit(x.trade, 'id', 'traded')
      };
    });

    assert.deepEqual(check_results, expected);
  });
});
