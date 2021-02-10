#!/usr/bin/env ts-node
import sorter from 'sorters';
import * as date from 'date-fns';
import { test, suite } from 'uvu';
import * as assert from 'uvu/assert';
import {
  DataPoint,
  technicalCalculator,
  TechnicalCondition,
} from './technicals';

const correctNumbers = {
  rsi: 45.98,
  rsi14: 42.98,
  UnadjustedClose: 205.31,
};

const barData: any[] = require('./test-bars.json');
const bars = barData
  .map((c) => {
    return {
      ...c,
      time: new Date(c.time),
    };
  })
  .sort(sorter({ value: (d) => d.time.valueOf(), descending: true }));

const calc = technicalCalculator('MSFT', bars);
const latestQuote = 205.31;
const latestCalc = calc.latest(latestQuote);
//console.dir(latestCalc);

function closeTo(actual, expected) {
  if (Math.abs(actual - expected) > 0.01) {
    throw new Error(
      `Expected ${expected.toFixed(2)} but saw ${actual.toFixed(2)}`
    );
  }
}

const sameDataBars = new Array(500).fill(0).map((_, index) => {
  return {
    open: 100,
    close: 100,
    low: 100,
    high: 100,
    volume: 100,
    time: date.subBusinessDays(new Date(), index),
  };
});

let allDataSameTest = suite('all data the same');

const sameDataCalcBase = technicalCalculator('T', sameDataBars);
const sameDataCalc = sameDataCalcBase.latest(100);

allDataSameTest('ema10', () => {
  closeTo(sameDataCalc.ema10, 100);
});

allDataSameTest('ema21', () => {
  closeTo(sameDataCalc.ema21, 100);
});

allDataSameTest('ma50', () => {
  closeTo(sameDataCalc.ma50, 100);
});

allDataSameTest('ma200', () => {
  closeTo(sameDataCalc.ma200, 100);
});

allDataSameTest('rsi14', () => {
  closeTo(sameDataCalc.rsi14, 50);
});

allDataSameTest('rsi20', () => {
  closeTo(sameDataCalc.rsi20, 50);
});

allDataSameTest.run();

let realDataTest = suite('real data');

realDataTest('ema10', () => {
  closeTo(latestCalc.ema10, 214.27);
});

realDataTest('ema21', () => {
  closeTo(latestCalc.ema21, 214.71);
});

realDataTest('ma50', () => {
  closeTo(latestCalc.ma50, 211.34);
});

realDataTest('ma200', () => {
  closeTo(latestCalc.ma200, 180.22);
});

realDataTest('rsi14', () => {
  closeTo(latestCalc.rsi14, correctNumbers.rsi14); // 42.11 from TOS
});

realDataTest('rsi20', () => {
  closeTo(latestCalc.rsi20, correctNumbers.rsi); // 45.27 from TOS
});

realDataTest.run();

let bollinger = suite('bollinger bands');

// These expected values were taking from ThinkOrSwim charts on 2020-09-10
bollinger('ma20', () => {
  closeTo((latestCalc as any).ma20, 215.94);
});

bollinger('lower 2SD', () => {
  closeTo(latestCalc.bollinger.lower2SD, 199.82);
});

bollinger('upper 2SD', () => {
  closeTo(latestCalc.bollinger.upper2SD, 232.06);
});

bollinger.run();

let evaluate = suite('evaluate');

evaluate('conditions', () => {
  let conditions: TechnicalCondition[] = [
    { l: DataPoint.Ma50, op: '>', r: 28 },
    { l: DataPoint.Ma50, op: '<', r: DataPoint.Ma200 },
    { l: DataPoint.Ma50, op: '>', r: DataPoint.Ma200 },
    { l: DataPoint.StockPrice, op: '>=', r: DataPoint.Ema10 },
  ];

  let expectedMet = [true, false, true, false];
  let expected = conditions.map((c, i) => ({ ...c, met: expectedMet[i] }));

  let results = latestCalc.evaluate(conditions);

  assert.equal(results, expected);
});

evaluate.run();
