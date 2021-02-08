import {
  QueryFunctionContext,
  useQueries,
  UseQueryOptions,
} from '@sveltestack/svelte-query';
import { HTTPError } from 'ky-universal';
import { OptionChain } from 'types';
import ky from './ssr-ky';

export function chainQueries(symbols: string[]) {
  return useQueries(chainQueryOptions(symbols));
}

function getChain({ queryKey }: QueryFunctionContext) {
  let symbol = queryKey[1];
  return ky(`api/chain/${symbol}`, {
    method: 'POST',
    json: {},
  }).json<OptionChain>();
}

export function chainQueryOptions(
  symbols: string[]
): UseQueryOptions<OptionChain, HTTPError, OptionChain>[] {
  return symbols.map((symbol) => {
    return {
      queryKey: ['chains', symbol],
      queryFn: getChain,
      keepPreviousData: true,
    };
  });
}
