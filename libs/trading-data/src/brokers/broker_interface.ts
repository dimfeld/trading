// This is really only a set of functions where we might want to call a different broker
// depending on the position or trade. For most functions the generic broker interface just
// decides (quotes always from Alpaca for example)

export interface Account {
  id: string;
  buyingPower: number;
  cash: number;
  dayTradeCount: number;
  dayTradesRestricted: boolean;
  isDayTrader: boolean;
  portfolioValue: number;
  maintenanceMargin: number;
}

/** Functions that need to be implemented by all brokers */
export interface Broker {
  refreshAuth(): Promise<any>;
  init(): void | Promise<any>;
  getAccount(): Promise<Account>;
}

/** Functions that need to be implemented by a broker that supports reading trades */
export interface ReadableTradeActivity {}

/** Functions that need to be implemented by a broker that supports making trades */
export interface TradeableBroker {}

export enum BarTimeframe {
  minute = 'minute',
  fiveminute = '5Min',
  fifteenminute = '15Min',
  day = 'day',
}

export interface BarOptions {
  symbols: string[];
  timeframe: BarTimeframe;

  /** The maximum number of bars to get */
  limit?: number;

  /** Get bars on or after this date */
  start?: Date;
  /** Get bars on or before this date. Must be used with `start` to get the proper results */
  end?: Date;
}
