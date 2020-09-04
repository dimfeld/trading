import get from 'lodash/get';
import shortid from 'shortid';
import {
  OptionLeg,
  Trade,
  PositionSimulator,
  Position,
  TradeLeg,
  optionInfoFromSymbol,
} from 'options-analysis';
import { DbTrade, DbPosition } from './api/entities';

export enum OpeningLegType {
  Call = 'call',
  Put = 'put',
  Stock = 'stock',
}

export interface OpeningLegByDelta {
  size: number;
  type: OpeningLegType;
  dte: string;
  delta: number;
}

export enum OpenAtTime {
  EndOfDay = 'end_of_day',
}

export enum Operator {
  Gt = '>',
  Lt = '<',
}

export enum DataPoint {
  StockPrice = 'stock_price',
  Ma10 = 'ma10',
  Ma21 = 'ma21',
  Ma50 = 'ma50',
  Ma200 = 'ma200',
}

export interface OpeningCondition {
  l: DataPoint;
  r: DataPoint | number;
  op: Operator;
}

export interface PositionStructure {
  legs?: OpeningLegByDelta[];
  conditions?: {
    closing: {
      profit_target?: number;
      stop_loss?: number;
      after_days?: number;
    };
    open_at?: OpenAtTime;
    opening?: OpeningCondition[];
  };
}

export interface Strategy {
  structure: PositionStructure;
}

export interface HasStructureAndStrategy {
  structure?: PositionStructure;
  strategyInfo: Strategy;
}

export function getStructureField(
  path: string[],
  position: HasStructureAndStrategy
) {
  return (
    get(position, ['strategyInfo', 'structure', ...path]) ||
    get(position, ['structure', ...path])
  );
}

export interface AppliedTrade {
  position: DbPosition;
  trade: DbTrade;
}

export function applyTrade(
  position: DbPosition,
  legs: TradeLeg[]
): AppliedTrade {
  let simulator = new PositionSimulator(position.legs);
  simulator.addLegs(legs);
  let newLegs = simulator.getFlattenedList();

  let gross = 0;
  let costBasis = position.cost_basis;
  for (let leg of legs) {
    let info = optionInfoFromSymbol(leg.symbol);
    let legGross = leg.size * leg.price * -1;
    if (info.expiration) {
      legGross *= 100;
    }

    gross += legGross;

    let positiveCostBasis = position.cost_basis > 0;
    let positiveTrade = legGross > 0;
    if (positiveCostBasis === positiveTrade) {
      costBasis += legGross;
    }
  }

  let newTrade: DbTrade = {
    position: position.id,
    commissions: 0,
    id: shortid.generate(),
    legs,
    gross,
    traded: new Date(),
    tags: [],
  };

  return {
    position: {
      ...position,
      legs: newLegs,
      trades: [...(position.trades || []), newTrade],
      profit: position.profit + gross,
      cost_basis: costBasis,
      close_date: newLegs.length ? null : position.close_date || new Date(),
    },
    trade: newTrade,
  };
}
