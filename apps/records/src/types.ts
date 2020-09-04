import { Change, MatchingPositionScore } from 'options-analysis';

export interface ITag {
  id: number;
  name: string;
  color: string;
}

export interface ITags {
  [id:string]: ITag;
}

export interface IStrategy {
  id : number;
  name : string;
  description : string;
  color: string;
  sort: number;
  defaults: Partial<IPosition>;
}

export interface IStrategies {
  [id: string]: IStrategy;
}

export interface IOptionLeg {
  symbol: string;
  size: number;
  price?: number;
}


export interface ITrade {
  id: string;
  name?: string;
  note?: string;
  tags: number[];
  gross: number;
  commissions: number;
  traded: string;

  legs: IOptionLeg[];
}

export interface ITradeObject extends ITrade {
  position: string;
}

export interface IPosition {
  id: string;
  broker: string;
  symbol: string;
  strategy: number;
  open_date : Date;
  close_date: Date;
  note: string;
  tags: number[];

  cost_basis: number;
  profit: number;
  buying_power: number;

  structure?: any;

  trades?: ITrade[];
  legs : IOptionLeg[];
}

export interface TradeAndPosition {
  position: IPosition;
  trade: ITrade;
}

export interface PositionChange extends TradeAndPosition {
  change: Change;
}

export interface UnderlyingWithTrade {
  underlying: string;
  trade: ITrade;
}

export interface TradeMatches extends UnderlyingWithTrade {
  matches: Array<MatchingPositionScore<IPosition>>;
}

export interface DbData {
  tags: ITags;
  sorted_tags: ITag[];
  strategies: IStrategies;
  sorted_strategies: IStrategy[];
  positions : {[symbol:string]: IPosition[]};
}
