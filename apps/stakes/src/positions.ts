import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@sveltestack/svelte-query';
import { mutationOptions } from './mutations';
import ky from './ssr-ky';
import get from 'lodash/get';
import { uid } from 'uid/secure';
import {
  OptionLeg,
  Trade,
  PositionSimulator,
  TradeLeg,
  optionInfoFromSymbol,
} from 'options-analysis';
import { DbTrade, DbPosition } from './api/entities';
import { Strategy, PositionStructure } from './strategies';

export type Position = Omit<DbPosition, 'trades'> & { trades: DbTrade[] };

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
  position: Position;
  trade: DbTrade;
}

export function applyTrade(position: Position, legs: TradeLeg[]): AppliedTrade {
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
    id: uid(),
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

export function initPositionsQuery(initialData: Record<string, Position>) {
  let client = useQueryClient();
  client.setQueryDefaults('positions', { initialData });
}

export function positionsQuery() {
  return useQuery<Record<string, Position>>('positions');
}

export function updatePositionMutation() {
  return useMutation(
    (position: Position) =>
      ky
        .put(`/api/positions/${position.id}`, { json: position })
        .json<Position>(),
    mutationOptions({ optimisticUpdateKey: ['positions'] })
  );
}

export function createPositionMutation() {
  return useMutation((position: Omit<Position, 'id'>) =>
    ky.post(`/api/positions`, { json: position }).json<Position>()
  );
}
