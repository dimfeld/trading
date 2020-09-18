import { Dictionary } from 'lodash';
import isNil from 'lodash/isNil';
import { writable, Readable } from 'svelte/store';
import ky from './ssr-ky';
import debugMod from 'debug';

const debug = debugMod('quotes');

export type QuoteData = any;

export interface QuotesStore extends Readable<Map<string, QuoteData>> {
  registerInterest: (
    key: string,
    symbols: string[] | Set<string>
  ) => () => void;
  unregisterInterest: (key: string) => void;
}

export default function quotesStore(
  initialData?: Map<string, QuoteData>
): QuotesStore {
  let interest = new Map<string, string[] | Set<string>>();
  let refreshSymbols = new Set<string>();

  let store = writable(initialData || new Map<string, QuoteData>(), () => {
    doRequest();
    let interval = setInterval(() => doRequest(), 60000);
    return () => clearInterval(interval);
  });

  async function doRequest(symbols?: string[]) {
    symbols = symbols || Array.from(refreshSymbols);

    if (!symbols.length) {
      return;
    }

    let result: Dictionary<QuoteData> = await ky('api/quotes', {
      method: 'POST',
      json: { symbols },
    }).then((r) => r.json());

    store.update((val) => {
      for (let [symbol, quote] of Object.entries(result)) {
        val.set(symbol, quote);
      }
      return val;
    });
  }

  function regenerate() {
    let symbolsOfInterest = new Set<string>();
    let newSymbols = new Set<string>();
    for (let symbols of interest.values()) {
      for (let symbol of symbols) {
        symbolsOfInterest.add(symbol);

        if (!refreshSymbols.has(symbol)) {
          newSymbols.add(symbol);
        }
      }
    }

    refreshSymbols = symbolsOfInterest;
    debug('quote symbols', refreshSymbols);

    if (newSymbols.size) {
      doRequest(Array.from(newSymbols));
    }
  }

  function unregisterInterest(key: string) {
    interest.delete(key);
    regenerate();
  }

  return {
    subscribe: store.subscribe,
    /**
     * Register interest in a set of symbols. The quotes store will periodically fetch quotes for these symbols until interest is
     * unregistered, either by calling the callback from this function or calling `store.unregisterInterest` with the same argument for `key`.
     */
    registerInterest: (key: string, symbols: string[] | Set<string>) => {
      interest.set(key, symbols);
      regenerate();
      return () => unregisterInterest(key);
    },
    unregisterInterest,
  };
}

export function quoteLabel(quoteData: QuoteData) {
  console.dir(quoteData);
  if (!quoteData) {
    return null;
  }

  let value = quoteData.mark || quoteData.lastPrice;
  if (isNil(value)) {
    return null;
  }
  let change = quoteData.netChange;
  // Negative values automatically get a minus, so just add a plus for positive values.
  let sign = change > 0 ? '+' : '';
  let pct = (100 * Math.abs(change)) / value;

  return `${value.toFixed(2)} (${sign}${change.toFixed(2)} ${pct.toFixed(1)}%)`;
}
