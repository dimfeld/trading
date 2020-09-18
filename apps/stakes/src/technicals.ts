import { Bar, BarTimeframe } from 'types';
import ky from './ssr-ky';
import {
  LatestTechnicals,
  TechnicalCalculator,
  technicalCalculator,
} from 'options-analysis';
import { derived, Readable, writable } from 'svelte/store';
import { QuoteData } from './quotes';

export type TechnicalsStore = Readable<LatestTechnicals | null>;

export function technicalsStore(
  quotes: Readable<Map<string, QuoteData>>,
  bars: Readable<Bar[]  |  null>,
  symbol: string
): TechnicalsStore {
  let calc: TechnicalCalculator;
  let lastBars: Bar[];
  let lastQuote = 0;

  return derived(
    [quotes, bars],
    ([$quotes, $bars], set) => {
      let quote = $quotes.get(symbol);
      if (!quote || (!$bars && !calc)) {
        return;
      } else if ($bars && lastBars !== $bars) {
        calc = technicalCalculator(symbol, $bars);
        lastBars = $bars;
      }

      let price = quote.lastPrice || quote.mark;
      if (price && lastQuote !== price) {
        set(calc.latest(price));
        lastQuote = price;
      }
    },
    null as LatestTechnicals | null
  );
}

function getBars(symbols: string[], timeframe: BarTimeframe) {
  return ky('api/bars', {
    method: 'POST',
    json: {
      symbols,
      timeframe,
    },
  }).then((r) => r.json());
}

const barsStoreCache = new Map<string, Readable<Bar[] | null>>();

export function barsStore(
  symbol: string,
  timeframe: BarTimeframe,
  autoupdate = false
) {
  let cacheKey = symbol + timeframe;
  let cached = barsStoreCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  let store = writable(null as Bar[] | null, (set) => {
    update();
    if (autoupdate) {
      let timer = startAutorefresh();
      return () => clearInterval(timer);
    }
  });

  async function update() {
    let bars = await getBars([symbol], timeframe);
    let result = bars[symbol];
    if (result) {
      store.set(result);
    }
  }

  function startAutorefresh() {
    // This doesn't really make sense, as it should instead try to predict when a new bar
    // will be available. But good enough to start, and a websocket connection would be better for that anyway.
    let updateIntervalMinutes: number;
    switch (timeframe) {
      case BarTimeframe.day:
        updateIntervalMinutes = 60 * 24;
        break;
      case BarTimeframe.thirtyminute:
        updateIntervalMinutes = 30;
        break;
      case BarTimeframe.fifteenminute:
        updateIntervalMinutes = 15;
        break;
      case BarTimeframe.fiveminute:
        updateIntervalMinutes = 5;
        break;
      case BarTimeframe.minute:
        updateIntervalMinutes = 1;
        break;
    }

    if (!updateIntervalMinutes) {
      console.error(`No update interval defined for BarTimeframe ${timeframe}`);
    }

    return setInterval(update, updateIntervalMinutes * 60000);
  }

  let result = {
    subscribe: store.subscribe,
    refresh: update,
  };

  barsStoreCache.set(cacheKey, result);

  return result;
}
