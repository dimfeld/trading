import * as puppeteer from 'puppeteer';
import * as _ from 'lodash';
import * as csvStringify from 'csv-stringify';

import { login, AuthInfo } from './login';
import { Backtest } from './backtest';
import { Scanner, Strategy, StrategyTickers } from './scanner';
import { createWriteStream } from 'fs';

export interface Options {
  browser : puppeteer.Browser;
  auth : AuthInfo;
}

export class TradeMachine {

  browser : puppeteer.Browser;
  auth : AuthInfo;

  scanner : Scanner;
  backtest : Backtest;

  constructor(options : Options) {
    this.browser = options.browser;
    this.auth = options.auth;
  }

  async init() {
    let page = await this.browser.newPage();
    await login(page, this.auth);

    // this.backtest = new Backtest(await this.browser.newPage());
    this.scanner = new Scanner(await this.browser.newPage());

    return page.close();
  }

  close() {
    return Promise.all([
      this.scanner.close(),
      // this.backtest.close(),
    ]);
  }
}

const strategies = {
  'call_3d_preearnings': Strategy.LongCall3DaysPreEarnings,
  'call_7d_preearnings': Strategy.LongCall7DaysPreEarnings,
  'call_14d_preearnings': Strategy.LongCall14DaysPreEarnings,
  'strangle_4d_preearnings': Strategy.Straddle4DaysPreEarnings,
  'strangle_7d_preearnings': Strategy.Straddle7DaysPreEarnings,
  'strangle_14d_preearnings': Strategy.Straddle14DaysPreEarnings,
  'iron_condor_post_earnings': Strategy.PostEarningsIronCondor,
  'long_call_post_earnings': Strategy.PostEarningsLongCall,
  'long_put_post_earnings': Strategy.PostEarningsLongPut,
  'long_straddle_post_earnings': Strategy.PostEarningsStraddle,
  'put_spread_post_earnings': Strategy.PostEarningsPutSpread,
};

async function run() {
  let auth = require('../auth.json');
  let browser = await puppeteer.launch();
  let tm = new TradeMachine({ browser, auth });

  await tm.init();

  let outputStream = createWriteStream('output.csv');
  let writer = csvStringify();
  writer.pipe(outputStream);

  let header = ['symbol','wins','losses','win_rate','avg_trade_return','total_return','backtest_length','next_earnings','prev_earnings_result','strategy'];
  writer.write(header);

  let chosenStrategies = Object.keys(strategies);

  for(let strategy of chosenStrategies) {
    let data = await tm.scanner.get_strategy({
      strategy: strategies[strategy],
      tickers: StrategyTickers.All,
    });
    console.error(`Got ${data.rows.length} items for strategy ${strategy}`);

    _.each(data.rows, (row) => {
      let output = row.concat(strategy);
      if(output.length !== header.length) {
        throw new Error(`Expected ${header.length} columns but saw ${output.length}`);
      }
      writer.write(output);
    });
  }

  writer.end();

  await tm.close();
  await browser.close();
}

if(require.main === module) {
  run().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
