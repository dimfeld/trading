import {
  QueryKey,
  UseMutationOptions,
  useQueryClient,
} from '@sveltestack/svelte-query';

export interface HasId {
  id: string | number;
}

export interface MutationOptions<
  T extends HasId,
  CONTEXT extends { previousData?: Record<string, T> }
> {
  invalidate?: QueryKey[];
  optimisticUpdateKey?: QueryKey;

  onMutate?: UseMutationOptions<
    T,
    any,
    any,
    Omit<CONTEXT, 'previousData'>
  >['onMutate'];
  onError?: UseMutationOptions<T, any, any, CONTEXT>['onError'];
  onSettled?: UseMutationOptions<T, any, any, CONTEXT>['onSettled'];
}

export function mutationOptions<
  T extends HasId,
  CONTEXT extends { previousData?: Record<string, T> }
>(
  options: MutationOptions<T, CONTEXT>
): Partial<UseMutationOptions<T, any, any, CONTEXT>> {
  let queryClient = useQueryClient();

  return {
    async onMutate(data: T) {
      let previousData: Record<string, T> | undefined;
      if (options.optimisticUpdateKey) {
        await queryClient.cancelQueries(options.optimisticUpdateKey);
        previousData = queryClient.getQueryData<Record<string, T>>(
          options.optimisticUpdateKey
        );

        queryClient.setQueryData(
          options.optimisticUpdateKey,
          (current: Record<string, T> | undefined) => ({
            ...(current || {}),
            [data.id]: data,
          })
        );
      }

      let c = options.onMutate ? await options.onMutate(data) : {};
      return { ...c, previousData };
    },
    onError(err, data, context) {
      if (context && options.optimisticUpdateKey) {
        // Undo the optimistic update
        queryClient.setQueryData(
          options.optimisticUpdateKey,
          context.previousData
        );
      }

      return options.onError?.(err, data, context);
    },
    onSettled(data, error, variables, context) {
      for (let key of options.invalidate ?? []) {
        queryClient.invalidateQueries(key);
      }

      return options.onSettled?.(data, error, variables, context);
    },
  };
}
