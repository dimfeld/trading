// This is really only a set of functions where we might want to call a different broker
// depending on the position or trade. For most functions the generic broker interface just
// decides (quotes always from Alpaca for example)

import { Account, BarTimeframe, Trade } from 'types';

/** Functions that need to be implemented by all brokers */
export interface Broker {
  refreshAuth(): Promise<any>;
  init(): void | Promise<any>;
  getAccount(): Promise<Account>;
}

export interface GetBarsOptions {
  symbols: string[];
  timeframe: BarTimeframe;

  /** The maximum number of bars to get */
  limit?: number;

  /** Get bars on or after this date */
  start?: Date;
  /** Get bars on or before this date. Must be used with `start` to get the proper results */
  end?: Date;
}

export interface GetTradeOptions {
  startDate?: Date;
  endDate?: Date;
  filled?: boolean;
}

export interface GetTrades {
  getTrades(options: GetTradeOptions): Promise<Trade[]>;
}
