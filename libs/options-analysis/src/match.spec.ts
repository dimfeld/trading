/* tslint:disable no-implicit-dependencies */
import { matchPositions } from './match';
import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { BrokerChoice } from 'types';

test('matches', function () {
  let positions = [
    {
      broker: BrokerChoice.alpaca,
      legs: [
        { symbol: 'a', size: 5 },
        { symbol: 'c', size: -3 },
      ],
    },
    {
      broker: BrokerChoice.alpaca,
      legs: [
        { symbol: 'a', size: 5 },
        { symbol: 'b', size: -3 },
      ],
    },
    {
      broker: BrokerChoice.alpaca,
      legs: [
        { symbol: 'd', size: 5 },
        { symbol: 'f', size: -3 },
      ],
    },
  ];

  let trade = {
    broker: BrokerChoice.alpaca,
    legs: [
      { symbol: 'a', size: -5 },
      { symbol: 'b', size: 3 },
    ],
  };

  let results = matchPositions(BrokerChoice.alpaca, trade, positions);

  let expected = [
    { score: 1, overlapping: 2, position: positions[1] },
    { score: 0.5, overlapping: 1, position: positions[0] },
  ];
  assert.equal(results, expected);
});

test.run();
