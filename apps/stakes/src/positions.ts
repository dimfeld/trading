import { useMutation, useQuery } from '@sveltestack/svelte-query';
import { getContext, setContext } from 'svelte';
import { mutationOptions } from './mutations';
import ky from './ssr-ky';
import get from 'lodash/get';
import { uid } from 'uid/secure';
import {
  OptionLeg,
  Trade,
  PositionSimulator,
  Position,
  TradeLeg,
  optionInfoFromSymbol,
} from 'options-analysis';
import { DbTrade, DbPosition } from './api/entities';
import { Strategy, PositionStructure } from './strategies';

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

export function createPositionsQuery(initialData: Record<string, DbPosition>) {
  let q = useQuery<Record<string, DbPosition>>('positions', { initialData });
  setContext('positions', q);
  return q;
}

export function positionsQuery() {
  return getContext<ReturnType<typeof createPositionsQuery>>('positions');
}

export function updatePositionMutation() {
  return useMutation(
    (position: DbPosition) =>
      ky
        .put(`/api/positions/${position.id}`, { json: position })
        .json<DbPosition>(),
    mutationOptions({ optimisticUpdateKey: ['positions'] })
  );
}

export function createPositionMutation() {
  return useMutation((position: Omit<DbPosition, 'id'>) =>
    ky.post(`/api/positions`, { json: position }).json<DbPosition>()
  );
}
