import * as puppeteer from 'puppeteer';

const BACKTEST_URL = 'https://tm.cmlviz.com/index.php#backtest';

export class Backtest {
  page : puppeteer.Page;

  constructor(page : puppeteer.Page) {
    this.page = page;
  }

  close() {
    return this.page.close();
  }
}
