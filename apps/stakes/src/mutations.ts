import {
  QueryClient,
  QueryKey,
  UseMutationOptions,
  useQueryClient,
} from '@sveltestack/svelte-query';
import { HTTPError } from 'ky-universal';

export interface HasId {
  id: string | number;
}

export type PreviousData = [QueryKey, any][];

export interface MutationOptions<
  T extends HasId,
  VARIABLES = T,
  CONTEXT extends { previousData?: PreviousData } = {
    previousData?: PreviousData;
  }
> {
  invalidate?: QueryKey[];
  optimisticUpdates?: (
    client: QueryClient,
    item: VARIABLES
  ) => Promise<PreviousData>;

  notifications?: {
    addNotification: (n: { text: string; theme?: string }) => void;
  };

  onMutate?: UseMutationOptions<
    T,
    HTTPError,
    VARIABLES,
    Omit<CONTEXT, 'previousData'>
  >['onMutate'];
  onError?: UseMutationOptions<T, HTTPError, VARIABLES, CONTEXT>['onError'];
  onSettled?: UseMutationOptions<T, HTTPError, VARIABLES, CONTEXT>['onSettled'];
}

export function mutationOptions<
  T extends HasId,
  VARIABLES = T,
  CONTEXT extends { previousData?: PreviousData } = {
    previousData?: PreviousData;
  }
>(
  options: MutationOptions<T, VARIABLES, CONTEXT>
): Partial<UseMutationOptions<T, HTTPError, VARIABLES, CONTEXT>> {
  let queryClient = useQueryClient();

  return {
    async onMutate(data: VARIABLES) {
      let previousData: PreviousData | undefined;
      if (options.optimisticUpdates) {
        previousData = await options.optimisticUpdates(queryClient, data);
      }

      let c = options.onMutate ? await options.onMutate(data) : {};
      return { ...c, previousData };
    },
    onError(err, data, context) {
      if (context?.previousData) {
        // Undo the optimistic update
        for (let [key, data] of context.previousData) {
          queryClient.setQueryData(key, data);
        }
      }

      options.notifications?.addNotification({
        theme: 'error',
        text: err.message,
      });

      return options.onError?.(err, data, context);
    },
    onSuccess() {
      options.notifications?.addNotification({
        theme: 'success',
        text: 'Success!',
      });
    },
    onSettled(data, error, variables, context) {
      for (let key of options.invalidate ?? []) {
        queryClient.invalidateQueries(key);
      }

      return options.onSettled?.(data, error, variables, context);
    },
  };
}

export async function optimisticUpdateSingleton<T extends HasId>(
  client: QueryClient,
  key: QueryKey,
  data: T
): Promise<[QueryKey, T | undefined]> {
  await client.cancelQueries(key);
  let thisOne = client.getQueryData<T>(key);
  client.setQueryData(key, data);

  return [key, thisOne];
}

export async function optimisticUpdateCollectionMember<T extends HasId>(
  client: QueryClient,
  key: QueryKey,
  data: T
): Promise<[QueryKey, Record<string, T> | undefined]> {
  await client.cancelQueries(key);
  let overall = client.getQueryData<Record<string, T>>(key);
  client.setQueryData(key, {
    ...(overall || {}),
    [data.id]: data,
  });

  return [key, overall];
}

export async function optimisticDeleteCollectionMember<T extends HasId>(
  client: QueryClient,
  key: QueryKey,
  id: string
): Promise<[QueryKey, Record<string, T> | undefined]> {
  await client.cancelQueries(key);
  let overall = client.getQueryData<Record<string, T>>(key);
  let { [id]: _, ...rest } = overall ?? {};
  client.setQueryData(key, rest);
  return [key, overall];
}
