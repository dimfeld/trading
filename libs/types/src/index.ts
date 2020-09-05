export * from './option_chain';
export * from './quote';
export * from './trades';
export * from './db';

export interface MarketStatus {
  open: boolean;
  nextOpen: Date;
  nextClose: Date;
}

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

export enum BarTimeframe {
  minute = 'minute',
  fiveminute = '5Min',
  fifteenminute = '15Min',
  day = 'day',
}
