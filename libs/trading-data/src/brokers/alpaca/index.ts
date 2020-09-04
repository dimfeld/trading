import * as Alpaca from '@alpacahq/alpaca-trade-api';
import { Account, Broker, GetBarsOptions } from '../broker_interface';

export interface AlpacaBrokerOptions {
  key: string;
  secret: string;
  paper?: boolean;
}

const token = require('../../../../../alpaca_auth_paper.json');

export const alpaca = new Alpaca({
  keyId: token.key,
  secretKey: token.secret,
  paper: true,
  usePolygon: true,
});

export class Api implements Broker {
  api: Alpaca;

  constructor(options: AlpacaBrokerOptions) {
    this.api = new Alpaca({
      keyId: options.key,
      secretKey: options.secret,
      paper: options.paper ?? false,
      usePolygon: true,
    });
  }

  // Nothing to do here.
  init() {}
  async refreshAuth() {}

  async getAccount(): Promise<Account> {
    let data = await this.api.getAccount();
    return {
      id: data.id,
      buyingPower: +data.buying_power,
      cash: +data.cash,
      dayTradeCount: +data.daytrade_count,
      dayTradesRestricted: data.pattern_day_trader,
      isDayTrader: +data.equity < 25000,
      portfolioValue: +data.equity,
      maintenanceMargin: +data.maintenance_margin,
    };
  }

  async getBars(options: GetBarsOptions) {
    return this.api.getBars(options.timeframe, options.symbols.join(','), {
      start: options.start,
      end: options.end,
      limit: options.limit,
    });
  }
}
