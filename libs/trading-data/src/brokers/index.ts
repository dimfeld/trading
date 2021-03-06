import * as tda from './tda';
import * as alpaca from './alpaca';
import * as date from 'date-fns';
import * as debugMod from 'debug';
import sorter from 'sorters';
import { GetBarsOptions } from './broker_interface';
import {
  Account,
  Bar,
  MarketStatus,
  MarketCalendar,
  Position,
  BrokerChoice,
  MarketCalendarDate,
  BarTimeframe,
} from 'types';
import {
  waitForOrders,
  WaitForOrdersOptions,
  CreateOrderOptions,
} from './orders';
import { defaultTdaAuth, defaultAlpacaAuth } from './default_auth';
import { GetOrderOptions } from '..';
import { TimeCache, timeCache } from '../time_cache';

export { GetBarsOptions, GetOrderOptions } from './broker_interface';
export { GetOptionChainOptions, AuthData as TdaAuthData } from './tda';

export * from './default_auth';

const debug = debugMod('brokers');

export interface BrokerOptions {
  tda?: {
    auth: tda.AuthData;
    /** Defaults to true */
    autorefresh?: boolean;
  };
  alpaca?: alpaca.AlpacaBrokerOptions;
}

interface OneBarOption {
  symbol: string;
  numBars?: number;
  start?: Date;
  end?: Date;
  unadjusted?: boolean;
}

// This ignores BarTimeframe since we only use it for day bars.
function oneBarOptionKey(symbol: string, o: GetBarsOptions) {
  return [symbol, o.numBars, o.start, o.end, o.unadjusted].join(';');
}

/** A class that arbitrates requests through multiple brokers */
export class Brokers {
  tda?: tda.Api;
  alpaca?: alpaca.Api;

  barsCache: TimeCache<Bar[]>;
  calendarCache: TimeCache<MarketCalendar>;

  constructor({ tda: tdaOptions, alpaca: alpacaOptions }: BrokerOptions = {}) {
    tdaOptions = tdaOptions ?? { auth: defaultTdaAuth(), autorefresh: true };
    alpacaOptions = alpacaOptions ?? defaultAlpacaAuth();
    this.tda = new tda.Api(tdaOptions.auth, tdaOptions.autorefresh ?? true);
    this.alpaca = new alpaca.Api(alpacaOptions);
    this.barsCache = timeCache(3600 * 4 * 1000);
    this.calendarCache = timeCache(3600 * 1000);
  }

  init() {
    return Promise.all([this.alpaca?.init(), this.tda?.init()]);
  }

  end() {
    return Promise.all([this.alpaca?.end(), this.tda?.end()]);
  }

  getAccount(broker?: BrokerChoice): Promise<Account[]> {
    debug('getAccount', broker);
    return Promise.all(
      this.resolveMaybeBrokerChoice(broker).map((api) => api.getAccount())
    );
  }

  async getBars(options: GetBarsOptions): Promise<Map<string, Bar[]>> {
    debug('getBars', options);
    // A more complex system will compare the requested bars with what we have in
    // Postgres or something and shape the queries to just get what we need.
    // This simple cache is more than sufficient for now.
    let cached = new Map<string, Bar[]>();
    let cacheKeys = new Map<string, string>();
    let neededSymbols: string[];

    if (options.timeframe === BarTimeframe.day) {
      neededSymbols = [];
      for (let s of options.symbols) {
        let key = oneBarOptionKey(s, options);
        let cachedResult = this.barsCache.get(key);
        if (cachedResult) {
          cached.set(s, cachedResult);
        } else {
          neededSymbols.push(s);
          cacheKeys.set(s, key);
        }
      }
    } else {
      neededSymbols = options.symbols;
    }

    let result = await this.tda.getBars({
      ...options,
      symbols: neededSymbols,
    });

    for (let [symbol, bars] of result.entries()) {
      bars.sort(
        sorter({ value: (b) => b.time, descending: !options.ascending })
      );

      this.barsCache.set(cacheKeys.get(symbol), bars);
    }

    for (let [symbol, bars] of cached.entries()) {
      result.set(symbol, bars);
    }

    return result;
  }

  async getPositions(broker?: BrokerChoice): Promise<Position[]> {
    debug('getPositions', broker);
    let pos = await Promise.all(
      this.resolveMaybeBrokerChoice(broker).map((api) => api.getPositions())
    );

    return pos.flat();
  }

  getQuotes(symbols: string[]) {
    debug('getQuotes', symbols);
    return this.tda.getQuotes(symbols);
  }

  getOptionChain(options: tda.GetOptionChainOptions) {
    debug('getOptionsChain', options);
    return this.tda.getOptionChain(options);
  }

  marketStatus(): Promise<MarketStatus> {
    debug('marketStatus');
    return this.alpaca.marketStatus();
  }

  /** Return market dates starting with the next business day and going back 300 business days.
   * This equates to roughly
   */
  async marketCalendar(): Promise<MarketCalendar> {
    debug('marketCalendar');
    let cached = this.calendarCache.get('cal');
    if (cached) {
      return cached;
    }

    let values = await this.alpaca.marketCalendar();

    values.sort(
      sorter({
        value: (c) => c.date.valueOf(),
        descending: false,
      })
    );

    let closestToToday = values.findIndex(
      (v) => date.isToday(v.date) || date.isFuture(v.date)
    );

    let result = {
      next: values.slice(closestToToday),
      past: values.slice(0, closestToToday).reverse(),
    };

    this.calendarCache.set('cal', result);
    return result;
  }

  private resolveBrokerChoice(choice: BrokerChoice) {
    switch (choice) {
      case BrokerChoice.alpaca:
        return this.alpaca;
      case BrokerChoice.tda:
        return this.tda;
    }
  }

  private resolveMaybeBrokerChoice(choice?: BrokerChoice) {
    return choice
      ? [this.resolveBrokerChoice(choice)]
      : [this.tda, this.alpaca].filter(Boolean);
  }

  createOrder(broker: BrokerChoice, options: CreateOrderOptions) {
    debug('createOrder', broker, options);
    let api = this.resolveBrokerChoice(broker);
    return api.createOrder(options);
  }

  getOrders(broker: BrokerChoice, options?: GetOrderOptions) {
    debug('getOrders', broker, options);
    let api = this.resolveBrokerChoice(broker);
    return api.getOrders(options);
  }

  waitForOrders(broker: BrokerChoice, options: WaitForOrdersOptions) {
    debug('waitForOrders', broker, options);
    let api = this.resolveBrokerChoice(broker);
    return waitForOrders(api, options);
  }
}

export async function createBrokers(options?: BrokerOptions) {
  let api = new Brokers(options);
  await api.init();
  return api;
}
