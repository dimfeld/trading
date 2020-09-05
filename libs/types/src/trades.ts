export enum BrokerChoice {
  tda = 'tda',
  alpaca = 'alpaca',
}

export interface Position {
  symbol: string;
  price: number;
  size: number;
  broker: BrokerChoice;
}

export interface TradeLeg {
  symbol: string;
  price: number;
  size: number;
  filled: number;
}

export enum TradeStatus {
  pending = 'pending',
  active = 'active',
  canceled = 'canceled',
  filled = 'filled',
  rejected = 'rejected',
}

export interface Trade {
  id: string;
  status: TradeStatus;
  traded: Date;
  price: number;
  commissions: number | null;
  legs: TradeLeg[];
}
