export * from './option_chain';
export * from './quote';
export * from './orders';
export * from './db';

export interface MarketStatus {
  open: boolean;
  nextOpen: Date;
  nextClose: Date;
}

export interface MarketCalendarDate {
  date: Date;
  open: string;
  close: string;
}

export interface MarketCalendar {
  current: MarketCalendarDate[];
  next: MarketCalendarDate | null;
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
  thirtyminute = '30Min',
  day = 'day',
}
