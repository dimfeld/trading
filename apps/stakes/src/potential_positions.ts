import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryOptions,
} from '@sveltestack/svelte-query';
import { getContext, setContext } from 'svelte';
import {
  mutationOptions,
  optimisticDeleteCollectionMember,
  optimisticUpdateCollectionMember,
  optimisticUpdateSingleton,
} from './mutations';
import { PositionStructure } from './strategies';
import ky from './ssr-ky';
import { arrayToObject } from './query';
import { HTTPError } from 'ky-universal';

export interface PotentialPosition {
  id: string;
  symbol: string;
  source: string;
  strategy: number;
  structure: PositionStructure | null;
  expires?: Date;
  notes: any;
  opened: boolean;
}

export function initPotentialPositionsQuery() {
  let client = useQueryClient();
  client.setQueryDefaults('potential_positions', {
    select: arrayToObject,
  });
}

export function potentialPositionsQuery() {
  return useQuery<Record<string, PotentialPosition>, HTTPError>(
    'potential_positions'
  );
}

export function potentialPositionQuery(id: string) {
  return useQuery<PotentialPosition, HTTPError>(
    potentialPositionQueryOptions(useQueryClient(), id)
  );
}

export function potentialPositionQueryOptions(
  client: QueryClient,
  id: string
): UseQueryOptions<PotentialPosition, HTTPError> {
  return {
    queryKey: ['potential_positions', id],
    initialData: () => {
      return client.getQueryData<Record<string, PotentialPosition>>(
        'potential_positions'
      )?.[id];
    },
  };
}

export function updatePotentialPositionMutation() {
  return useMutation(
    (position: PotentialPosition) =>
      ky
        .put(`api/potential_positions/${position.id}`, { json: position })
        .json<PotentialPosition>(),
    mutationOptions({
      optimisticUpdates: (client: QueryClient, position: PotentialPosition) =>
        Promise.all([
          optimisticUpdateCollectionMember(
            client,
            'potential_positions',
            position
          ),
          optimisticUpdateSingleton(
            client,
            ['potential_positions', position.id],
            position
          ),
        ]),
    })
  );
}

export function createPotentialPositionMutation() {
  return useMutation(
    (position: Omit<PotentialPosition, 'id'>) =>
      ky
        .post(`api/potential_positions`, { json: position })
        .json<PotentialPosition>(),
    mutationOptions({
      optimisticUpdates: (client: QueryClient, position: PotentialPosition) =>
        Promise.all([
          optimisticUpdateCollectionMember(
            client,
            'potential_positions',
            position
          ),
        ]),
    })
  );
}

export function deletePotentialPositionMutation() {
  return useMutation(
    (id: string) => ky.delete(`api/potential_positions/${id}`),
    mutationOptions<any, string>({
      optimisticUpdates: (client: QueryClient, id: string) =>
        Promise.all([
          optimisticDeleteCollectionMember(client, 'potential_positions', id),
        ]),
    })
  );
}
