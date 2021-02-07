import { useMutation, useQuery } from '@sveltestack/svelte-query';
import { getContext, setContext } from 'svelte';
import { mutationOptions } from './mutations';
import ky from './ssr-ky';

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
  id: number;
  name: string;
  description: string;
  color: string;
  structure: PositionStructure;
  sort: number;
  tags?: number[];
  short_name: string;
}

export function createStrategiesQuery(initialData: Record<string, Strategy>) {
  let q = useQuery<Record<string, Strategy>>('strategies', { initialData });
  setContext('strategies', q);
  return q;
}

export function strategiesQuery() {
  return getContext<ReturnType<typeof createStrategiesQuery>>('strategies');
}

export function updateStrategyMutation() {
  return useMutation(
    (strategy: Strategy) =>
      ky
        .put(`/api/strategies/${strategy.id}`, { json: strategy })
        .json<Strategy>(),
    mutationOptions({ optimisticUpdateKey: ['strategies'] })
  );
}

export function createStrategyMutation() {
  return useMutation((strategy: Omit<Strategy, 'id'>) =>
    ky.post(`/api/strategies`, { json: strategy }).json<Strategy>()
  );
}
