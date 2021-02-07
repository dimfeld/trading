import { useMutation, useQuery } from '@sveltestack/svelte-query';
import { getContext, setContext } from 'svelte';
import { mutationOptions } from './mutations';
import { PositionStructure } from './strategies';
import ky from './ssr-ky';

export interface PotentialPosition {
  id: string;
  symbol: string;
  source: string;
  strategy: number;
  structure: PositionStructure;
  expires?: Date;
  notes: any;
  opened: boolean;
}

export function createPotentialPositionsQuery(
  initialData: Record<string, PotentialPosition>
) {
  let q = useQuery<Record<string, PotentialPosition>>('potential_positions', {
    initialData,
  });
  setContext('potential_positions', q);
  return q;
}

export function potentialPositionsQuery() {
  return getContext<ReturnType<typeof createPotentialPositionsQuery>>(
    'potential_positions'
  );
}

export function updatePotentialPositionMutation() {
  return useMutation(
    (position: PotentialPosition) =>
      ky
        .put(`/api/potential_positions/${position.id}`, { json: position })
        .json<PotentialPosition>(),
    mutationOptions({ optimisticUpdateKey: ['potential_positions'] })
  );
}

export function createPotentialPositionMutation() {
  return useMutation((position: Omit<PotentialPosition, 'id'>) =>
    ky
      .post(`/api/potential_positions`, { json: position })
      .json<PotentialPosition>()
  );
}
