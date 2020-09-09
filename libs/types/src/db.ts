export interface DbTag {
  id: number;
  name: string;
  color: string;
}

export interface DbTags {
  [id: string]: DbTag;
}

export interface DbStrategy {
  id: number;
  name: string;
  description: string;
  color: string;
  sort: number;
  defaults: Partial<DbPosition>;
  tags: string[] | null;
}

export interface DbStrategies {
  [id: string]: DbStrategy;
}

export interface DbOptionLeg {
  symbol: string;
  size: number;
}

export interface DbOptionTradeLeg extends DbOptionLeg {
  price: number;
}

export interface DbTrade {
  id: string;
  /** position may be empty for newly-imported trades not yet linked to a position */
  position?: string;
  name?: string;
  note?: string;
  tags: number[];
  price_each: number;
  gross: number;
  commissions: number;
  traded: string;

  legs: DbOptionTradeLeg[];
}

export enum Momentum {
  PeakAboveProfitTarget = 'peak_above_profit_target',
}

export interface Algorithm {
  momentum?: Momentum;
}

export interface DbPosition {
  id: string;
  tags: number[];
  broker: string;
  symbol: string;
  strategy: number;
  open_date: Date;
  close_date: Date;
  note: string;

  cost_basis: number;
  profit: number;
  buying_power: number;

  structure: any;

  trades?: DbTrade[];
  legs: DbOptionLeg[];
}

export interface DbData {
  tags: DbTags;
  sorted_tags: DbTag[];
  strategies: DbStrategies;
  sorted_strategies: DbStrategy[];
  positions: { [symbol: string]: DbPosition[] };
}
