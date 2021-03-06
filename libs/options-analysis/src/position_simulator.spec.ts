/* tslint:disable no-implicit-dependencies */
import * as position from './position_simulator';
import { OptionLeg, fullSymbol } from './types';
import * as _ from 'lodash';
import { test, suite } from 'uvu';
import * as assert from 'uvu/assert';
import sorter from 'sorters';

function expectedLegs(legs: OptionLeg[]) {
  return _.transform(
    legs,
    (memo, leg) => {
      let fs = leg.symbol;
      let list = memo[fs] as OptionLeg[];
      if (list) {
        list.push(leg);
      } else {
        memo[fs] = [leg];
      }
    },
    {}
  );
}

function checkSimState(sim, legs, description = 'simulator state') {
  // Empty lists are undefined. Filter those out of the check so that deepEqual doesn't count them.
  let checkLegs = _.reduce(
    sim.legs,
    (memo, list, key) => {
      if (list !== undefined) {
        memo[key] = list;
      }
      return memo;
    },
    {}
  );
  assert.equal(checkLegs, expectedLegs(legs));

  let s = sorter('symbol');
  let flattened = _.chain(legs)
    .groupBy('symbol')
    .map((l, symbol) => {
      let size = _.sumBy(l, 'size');
      if (size) {
        return { symbol, size: size };
      }
    })
    .compact()
    .value()
    .sort(s);

  assert.equal(sim.getFlattenedList().sort(s), flattened);
}

let simulator = suite('simulator');
simulator('new position from scratch', function () {
  let sim = new position.PositionSimulator();
  let leg = {
    symbol: 'ANET  171020P00180000',
    size: 2,
    price: 4.35,
  };

  let result = sim.addLegs([leg]);

  let expected = [
    {
      affected: leg,
      changedBy: leg,
      change: position.Change.Opened,
      changeAmount: leg.size,
      totalSize: 2,
      pnl: 0,
      created: true,
    },
  ];

  assert.equal(result, expected);
  checkSimState(sim, [leg]);
});

simulator('multiple new positions from scratch', function () {
  let sim = new position.PositionSimulator();
  let legs = [
    {
      symbol: 'ANET  171020P00180000',
      size: 2,
      price: 4.35,
    },
    {
      symbol: 'ANET  171020P00170000',
      size: -2,
      price: 4.35,
    },
  ];

  let result = sim.addLegs(legs);

  let expected = [
    {
      affected: legs[0],
      changedBy: legs[0],
      change: position.Change.Opened,
      changeAmount: legs[0].size,
      totalSize: 2,
      pnl: 0,
      created: true,
    },
    {
      affected: legs[1],
      changedBy: legs[1],
      change: position.Change.Opened,
      changeAmount: legs[1].size,
      totalSize: -2,
      pnl: 0,
      created: true,
    },
  ];

  assert.equal(result, expected);
  checkSimState(sim, legs);
});

simulator('adding to a position', function () {
  let legs = [
    {
      symbol: 'ANET  171020P00180000',
      size: 2,
      price: 4.35,
    },
    {
      symbol: 'ANET  171020P00170000',
      size: -2,
      price: 4.35,
    },
  ];

  let sim = new position.PositionSimulator(legs);
  checkSimState(sim, legs, 'initial sim state');

  let newLegs = [
    {
      symbol: 'ANET  171020P00180000',
      size: 2,
      price: 4.35,
    },
    {
      symbol: 'ANET  171020P00170000',
      size: -2,
      price: 4.35,
    },
  ];

  let result = sim.addLegs(newLegs);
  let expectedResult = [
    {
      affected: newLegs[0],
      changedBy: newLegs[0],
      change: position.Change.Opened,
      changeAmount: newLegs[0].size,
      totalSize: 4,
      pnl: 0,
      created: true,
    },
    {
      affected: newLegs[1],
      changedBy: newLegs[1],
      change: position.Change.Opened,
      changeAmount: newLegs[1].size,
      totalSize: -4,
      pnl: 0,
      created: true,
    },
  ];

  assert.equal(result, expectedResult);
  checkSimState(sim, legs.concat(newLegs), 'sim state after add');
});

simulator('closing a position', function () {
  let legs = [
    {
      symbol: 'ANET  171020P00180000',
      size: 2,
      price: 4.35,
    },
    {
      symbol: 'ANET  171020P00170000',
      size: -2,
      price: 4.35,
    },
  ];

  let sim = new position.PositionSimulator(legs);
  checkSimState(sim, legs, 'initial sim state');

  let closingLegs = [
    {
      symbol: 'ANET  171020P00170000',
      size: 2,
      price: 2.45,
    },
    {
      symbol: 'ANET  171020P00180000',
      size: -2,
      price: 2.45,
    },
  ];

  let result = sim.addLegs([closingLegs[0]]);
  let expected = [
    {
      affected: legs[1],
      changedBy: closingLegs[0],
      change: position.Change.Closed,
      changeAmount: 2,
      totalSize: 0,
      created: false,
      pnl: (closingLegs[0].price - legs[1].price) * 2,
    },
  ];

  assert.equal(result, expected);
  checkSimState(sim, [legs[0]], 'sim state after close');

  result = sim.addLegs([closingLegs[1]]);
  expected = [
    {
      affected: legs[0],
      changedBy: closingLegs[1],
      change: position.Change.Closed,
      changeAmount: -2,
      totalSize: 0,
      created: false,
      pnl: (closingLegs[1].price - legs[0].price) * -2,
    },
  ];

  assert.equal(result, expected);
  checkSimState(sim, [], 'sim state after close');
});

simulator('partial close', function () {
  let legs = [
    {
      symbol: 'ANET  171020P00180000',
      size: 3,
      price: 4.35,
    },
    {
      symbol: 'ANET  171020P00170000',
      size: -3,
      price: 4.35,
    },
  ];

  let sim = new position.PositionSimulator(legs);
  checkSimState(sim, legs, 'initial sim state');

  let closingLegs = [
    {
      symbol: 'ANET  171020P00170000',
      size: 1,
      price: 2.45,
    },
    {
      symbol: 'ANET  171020P00180000',
      size: -1,
      price: 2.45,
    },
  ];

  let result = sim.addLegs([closingLegs[0]]);
  let reducedShort = _.extend({}, legs[1], { size: -2 });
  let expected = [
    {
      affected: reducedShort,
      changedBy: closingLegs[0],
      change: position.Change.Reduced,
      changeAmount: 1,
      totalSize: -2,
      created: false,
      pnl: null,
    },
    {
      affected: _.extend({}, legs[1], { size: -1 }),
      changedBy: closingLegs[0],
      change: position.Change.Closed,
      changeAmount: 1,
      totalSize: -2,
      created: true,
      pnl: legs[1].price - closingLegs[0].price,
    },
  ];

  let stateSort = sorter('affected.symbol');
  assert.equal(result.sort(stateSort), expected.sort(stateSort));
  checkSimState(sim, [reducedShort, legs[0]], 'sim state after closing short');

  result = sim.addLegs([closingLegs[1]]);
  let reducedLong = _.extend({}, legs[0], { size: 2 });
  expected = [
    {
      affected: reducedLong,
      changedBy: closingLegs[1],
      change: position.Change.Reduced,
      changeAmount: -1,
      totalSize: 2,
      created: false,
      pnl: null,
    },
    {
      affected: _.extend({}, legs[0], { size: 1 }),
      changedBy: closingLegs[1],
      change: position.Change.Closed,
      changeAmount: -1,
      totalSize: 2,
      created: true,
      pnl: closingLegs[1].price - legs[0].price,
    },
  ];

  let s = sorter('affected.symbol');
  assert.equal(result.sort(stateSort), expected.sort(stateSort));
  checkSimState(
    sim,
    [reducedShort, reducedLong],
    'sim state after closing long'
  );
});

simulator('rolling', function () {
  let initialState = [
    {
      symbol: 'ANET  171020P00180000',
      size: 3,
      price: 4.35,
    },
    {
      symbol: 'ANET  171020P00170000',
      size: -3,
      price: 4.35,
    },
  ];

  let sim = new position.PositionSimulator(initialState);
  checkSimState(sim, initialState, 'initial sim state');

  let rolling = [
    {
      symbol: 'ANET  171020P00180000',
      size: -3,
      price: 3.27,
    },
    {
      symbol: 'ANET  171020P00170000',
      size: 3,
      price: 3.15,
    },
    {
      symbol: 'ANET  171117P00180000',
      call: false,
      size: 3,
      price: 4.15,
    },
    {
      symbol: 'ANET  171117P00170000',
      size: -3,
      price: 4.1,
    },
  ];

  let result = sim.addLegs(rolling);
  let expectedResult = [
    {
      affected: initialState[0],
      changedBy: rolling[0],
      change: position.Change.Closed,
      changeAmount: -3,
      totalSize: 0,
      pnl: (4.35 - 3.27) * 3,
      created: false,
    },
    {
      affected: initialState[1],
      changedBy: rolling[1],
      change: position.Change.Closed,
      changeAmount: 3,
      totalSize: 0,
      pnl: (3.15 - 4.35) * 3,
      created: false,
    },
    {
      affected: rolling[2],
      changedBy: rolling[2],
      change: position.Change.Opened,
      changeAmount: 3,
      totalSize: 3,
      pnl: 0,
      created: true,
    },
    {
      affected: rolling[3],
      changedBy: rolling[3],
      change: position.Change.Opened,
      changeAmount: -3,
      totalSize: -3,
      pnl: 0,
      created: true,
    },
  ];

  assert.equal(result, expectedResult);
  checkSimState(sim, [rolling[2], rolling[3]], 'only opened legs are present');
});

// TEST TODO
// test('closing short and opening long at same strike');
// test('closing long and opening short at same strike');
// test('single list of options modifies the same one multiple times');

simulator.run();
test.run();
