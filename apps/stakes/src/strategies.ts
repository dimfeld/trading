import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@sveltestack/svelte-query';
import { mutationOptions, optimisticUpdateCollectionMember } from './mutations';
import { getNotificationsContext } from 'svelte-notifications';
import ky from './ssr-ky';
import { arrayToObject } from './query';

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
  Rsi14 = 'rsi14',
  Rsi20 = 'rsi20',
  BollingerUpper1SD = 'bollinger-upper-1sd',
  BollingerLower1SD = 'bollinger-upper-1sd',
  BollingerUpper2SD = 'bollinger-upper-2sd',
  BollingerLower2SD = 'bollinger-upper-2sd',
  BollingerUpper3SD = 'bollinger-upper-3sd',
  BollingerLower3SD = 'bollinger-upper-3sd',
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

export function initStrategiesQuery(initialData: Record<string, Strategy>) {
  let client = useQueryClient();
  client.setQueryData('strategies', initialData);
  client.setQueryDefaults('strategies', {
    select: arrayToObject,
  });
}

export function strategiesQuery() {
  return useQuery<Record<string, Strategy>>('strategies');
}

export function updateStrategyMutation() {
  let notifications = getNotificationsContext();
  return useMutation(
    (strategy: Strategy) =>
      ky
        .put(`api/strategies/${strategy.id}`, { json: strategy })
        .json<Strategy>(),
    mutationOptions({
      notifications,
      optimisticUpdates: (client: QueryClient, strategy: Strategy) =>
        Promise.all([
          optimisticUpdateCollectionMember(client, 'strategies', strategy),
        ]),
    })
  );
}

export function createStrategyMutation() {
  let notifications = getNotificationsContext();
  return useMutation(
    (strategy: Omit<Strategy, 'id'>) =>
      ky.post(`api/strategies`, { json: strategy }).json<Strategy>(),
    mutationOptions({
      notifications,
    })
  );
}
