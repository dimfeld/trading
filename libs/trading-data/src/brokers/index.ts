import * as tda from './tda';
import * as alpaca from './alpaca';
import { GetBarsOptions } from './broker_interface';
import { Account, Bar, MarketStatus, Position, BrokerChoice } from 'types';
import {
  waitForOrders,
  WaitForOrdersOptions,
  CreateOrderOptions,
} from './orders';
import { defaultTdaAuth, defaultAlpacaAuth } from './default_auth';
import { GetOrderOptions } from '..';

export { GetBarsOptions, GetOrderOptions } from './broker_interface';
export { GetOptionChainOptions, AuthData as TdaAuthData } from './tda';

export * from './default_auth';

export interface BrokerOptions {
  tda?: {
    auth: tda.AuthData;
    /** Defaults to true */
    autorefresh?: boolean;
  };
  alpaca?: alpaca.AlpacaBrokerOptions;
}

/** A class that arbitrates requests through multiple brokers */
export class Brokers {
  tda?: tda.Api;
  alpaca?: alpaca.Api;

  constructor({ tda: tdaOptions, alpaca: alpacaOptions }: BrokerOptions) {
    tdaOptions = tdaOptions ?? { auth: defaultTdaAuth(), autorefresh: true };
    alpacaOptions = alpacaOptions ?? defaultAlpacaAuth();
    this.tda = new tda.Api(tdaOptions.auth, tdaOptions.autorefresh ?? true);
    this.alpaca = new alpaca.Api(alpacaOptions);
  }

  init() {
    return Promise.all([this.alpaca?.init(), this.tda?.init()]);
  }

  end() {
    return Promise.all([this.alpaca?.end(), this.tda?.end()]);
  }

  getAccount(broker?: BrokerChoice): Promise<Account[]> {
    return Promise.all(
      this.resolveMaybeBrokerChoice(broker).map((api) => api.getAccount())
    );
  }

  getBars(options: GetBarsOptions): Promise<Map<string, Bar[]>> {
    if (!this.alpaca) {
      return Promise.reject(new Error('getBars requires the Alpaca broker'));
    }

    return this.alpaca.getBars(options);
  }

  async getPositions(broker?: BrokerChoice): Promise<Position[]> {
    let pos = await Promise.all(
      this.resolveMaybeBrokerChoice(broker).map((api) => api.getPositions())
    );

    return pos.flat();
  }

  getQuotes(symbols: string[]) {
    return this.tda.getQuotes(symbols);
  }

  getOptionChain(options: tda.GetOptionChainOptions) {
    return this.tda.getOptionChain(options);
  }

  marketStatus(): Promise<MarketStatus> {
    return this.alpaca.marketStatus();
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
    let api = this.resolveBrokerChoice(broker);
    return api.createOrder(options);
  }

  getOrders(broker: BrokerChoice, options?: GetOrderOptions) {
    let api = this.resolveBrokerChoice(broker);
    return api.getOrders(options);
  }

  waitForOrders(broker: BrokerChoice, options: WaitForOrdersOptions) {
    let api = this.resolveBrokerChoice(broker);
    return waitForOrders(api, options);
  }
}

export async function createBrokers(options: BrokerOptions) {
  let api = new Brokers(options);
  await api.init();
  return api;
}
