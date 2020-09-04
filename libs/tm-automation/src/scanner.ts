import * as puppeteer from 'puppeteer';
import * as debugMod from 'debug';
import * as _ from 'lodash';

const debug = debugMod('scanner');

const SCANNER_URL = 'https://tm.cmlviz.com/index.php#scan';

enum Mode {
  Unknown,
  Ticker,
  Strategy,
}

export enum StrategyTickers {
  Dow30 = 'dow30',
  NASDAQ100 = 'nasdaq100',
  SNP500 = 'snp500plus',
  All = 'all_tickers',
}

export enum Strategy {
  CoveredCalls = 'covered_call_all',
  ShortPutSpread = 'put_spread',
  LongStraddle = 'straddle_all',
  BullSqueezeCallSpread = 'bull_squeeze',
  BearSqueezeCallSpread = 'bear_squeeze',
  BullSqueezeCall = 'bull_squeeze_call',
  BullMammothCall = 'bull_mammoth_call',
  BearMammothPutSpread = 'bear_mammoth_put_spread',

  EarningsStrangles = "strangle_earnings",

  PostEarningsStraddle = "long_straddle_post_earnings",
  PostEarningsPutSpread = "shortputspread_post_earnings",
  PostEarningsIronCondor = "short_iron_condor_post_earnings",
  PostEarningsLongCall = "long_call_post_earnings_jump",
  PostEarningsLongPut = "long_put_post_earnings_drop",

  VolScalp6DaysPreEarnings = "double_straddle_pre_earnings",
  LongCall7DaysPreEarnings = "long_call_7_days_pre_earnings",
  LongCall14DaysPreEarnings = "long_call_pre_earnings",
  LongCall3DaysPreEarnings = "long_call_swing_pre_earnings",

  Straddle7DaysPreEarnings = "straddle_pre_earnings",
  Straddle14DaysPreEarnings = "straddle_14_days_pre_earnings",
  Straddle4DaysPreEarnings = "straddle_4days_pre_earnings",
}

export interface StrategyOptions {
  tickers : StrategyTickers;
  strategy : Strategy;
}

export class Scanner {
  page: puppeteer.Page;
  currentMode : Mode = Mode.Unknown;
  initialized = false;

  constructor(page: puppeteer.Page) {
    this.page = page;
  }

  close() {
    return this.page.close();
  }

  private async goto_mode(mode : Mode) {
    if(!this.initialized) {
      this.initialized = true;
      await this.page.setRequestInterception(true);
      this.page.on('request', (req) => {
        req.continue();
      });
    }

    if(this.currentMode === mode) {
      debug("Already in mode %s", mode);
      return;
    }

    if(this.currentMode === Mode.Unknown) {
      // Need to do the initial load
      debug("In unknown mode. Going to scanner");
      await this.page.goto(SCANNER_URL);
      debug("Waiting for ticker helper");
      await this.page.waitForSelector('#enter_ticker_helper', { visible: true });
    }

    debug("Switching modes...");
    let selector = mode === Mode.Ticker ? '#scan_mode_by_ticker' : '#scan_mode_by_strategy';
    await this.page.click(selector);

    debug("Waiting for mode switch");
    await this.page.waitForFunction((id) => {
      return document.querySelector(id).className.indexOf('mode-button-active') >= 0;
    }, {}, selector);

    this.currentMode = mode;
  }

  private async get_table() {
    const NEXT_BUTTON = '#trades_table_next';
    const ONE_BUTTON = '#trades_table_paginate > span > a:nth-child(1)';
    const TABLE_HEADER = '#trades_table > thead > tr';
    const ROWS = '#trades_table > tbody > tr';

    // Make sure we're at the start.
    debug("Moving to first page");
    let one_button = await this.page.$(ONE_BUTTON);
    await one_button.click();

    var more_pages = async () => {
      return this.page.$eval(NEXT_BUTTON, el => el.getAttribute('class').indexOf('disabled') < 0);
    };

    let header = await this.page.$eval(TABLE_HEADER, (r) => {
      var results = [];
      r.querySelectorAll('th').forEach((c) => results.push(c.textContent.trim()));
      return results;
    });

    let rows = [];
    var get_rows = async () => {
      let data = await this.page.$$eval(ROWS, (dom_rows) => {
        let rows_out = [];
        for(let dom_row of dom_rows.values()) {
          let row_output = [];
          dom_row.querySelectorAll('td').forEach((c) => row_output.push(c.textContent.trim()));
          rows_out.push(row_output);
        }
        return rows_out;
      });

      // debug("Got %d rows", data.length);
      rows.push(...data);
    };

    await get_rows();
    while(await more_pages()) {
      // debug("Fetching next page");
      let next_button = await this.page.$(NEXT_BUTTON);
      await next_button.click({ delay: 5 });
      await get_rows();
    }


    debug("Got %d total rows", rows.length);
    return {
      columns: header,
      rows,
    };
  }

  async get_tickers(symbols : string[]) {
    await this.goto_mode(Mode.Ticker);

    await this.page.click('#ticker_input', { clickCount: 3 });
    await this.page.keyboard.type(symbols.join(','));
    await this.page.keyboard.press('Enter');
    await this.page.waitForSelector('#trades_table_filter', { visible: true });

    return this.get_table();
  }

  async get_strategy(options : StrategyOptions) {
    let getText = () => {
      return this.page.evaluate(() => {
        let val = document.querySelector('#trades_table_info');
        let text = val ? val.innerHTML : '';
        let m = /of (.*) entries/.exec(text);
        return m ? m[1] : '';
      });
    };
    let currentText = await getText();

    await this.goto_mode(Mode.Strategy);
    await this.page.click(`#${options.tickers}`, { delay: 100 });

    let responsePromise = new Promise((resolve, reject) => {
      let responseListener = (res : puppeteer.Response) => {
        if(/run_scan\.php/.test(res.url())) {
          debug("Received response");
          this.page.removeListener('response', responseListener);
          resolve();
        }
      };

      this.page.on('response', responseListener);
    });


    debug("Clicking %s", options.strategy);
    await this.page.click(`#${options.strategy}`, { delay: 100 });

    await timeout(1000);

    debug("Waiting for loading spinner to disappear");
    await this.page.waitForFunction(() => {
      return document.querySelector('#scan_results > div > img') === null;
    });

    debug("Loading spinner is gone");

    await responsePromise;

    await this.page.waitForFunction((checkText) => {
      let val = document.querySelector('#trades_table_info');
      let newText = val ? val.innerHTML : '';
      let m = /of (.*) entries/.exec(newText);
      let newMatch = m ? m[1] : '';
      return newMatch && newMatch !== checkText;
    }, {}, currentText);

    if(debug.enabled) {
      debug("text value from %s to %s", currentText, await getText());
    }

    await this.page.waitForSelector('#trades_table', { visible: true });
    await timeout(1000);

    return this.get_table();
  }
}

async function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}