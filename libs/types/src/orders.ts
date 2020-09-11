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

export interface OrderLeg {
  symbol: string;
  price?: number;
  size: number;
  filled: number;
}

export enum OrderStatus {
  pending = 'pending',
  active = 'active',
  canceled = 'canceled',
  filled = 'filled',
  rejected = 'rejected',
}

export enum OrderType {
  market = 'market',
  limit = 'limit',
  stop = 'stop',
  stopLimit = 'stop-limit',
}

export enum OrderDuration {
  day = 'day',
  gtc = 'gtc',
}

export interface Order {
  id: string;
  broker: BrokerChoice;
  status: OrderStatus;
  traded: Date;
  price: number;
  commissions: number | null;
  legs: OrderLeg[];
}
