import { fullSymbol, optionInfoFromSymbol, optionInfoFromLeg } from './types';
import { suite, test } from 'uvu';
import * as assert from 'uvu/assert';

let fullSymbolSuite = suite('fullSymbol');

fullSymbolSuite('put', function () {
  let leg = {
    underlying: 'ANET',
    strike: 180,
    expiration: '171020',
    call: false,
    size: 2,
  };

  assert.equal(fullSymbol(leg), 'ANET  171020P00180000');
});

fullSymbolSuite('call', function () {
  let leg = {
    underlying: 'ABCDEF',
    strike: 5.75,
    expiration: '171020',
    call: true,
    size: 2,
  };

  assert.equal(fullSymbol(leg), 'ABCDEF171020C00005750');
});

fullSymbolSuite('stock', function () {
  let leg = {
    underlying: 'IBM',
    strike: null,
    expiration: null,
    call: null,
    size: 300,
  };

  assert.equal(fullSymbol(leg), 'IBM');
});
fullSymbolSuite.run();

let optionInfoFromSymbolSuite = suite('optionInfoFromSymbol');

optionInfoFromSymbolSuite('call', function () {
  let expected = {
    underlying: 'ABCDEF',
    strike: 5.75,
    expiration: '171020',
    call: true,
  };

  let seen = optionInfoFromSymbol('ABCDEF171020C00005750');
  assert.equal(seen, expected);
});

optionInfoFromSymbolSuite('put', function () {
  let expected = {
    underlying: 'ANET',
    strike: 180,
    expiration: '171020',
    call: false,
  };

  let seen = optionInfoFromSymbol('ANET  171020P00180000');
  assert.equal(seen, expected);
});

optionInfoFromSymbolSuite('stock', function () {
  let expected = {
    underlying: 'ANET',
    expiration: undefined,
    call: undefined,
    strike: undefined,
  };

  let seen = optionInfoFromSymbol('ANET');
  assert.equal(seen, expected);
});

optionInfoFromSymbolSuite.run();

test.run();
