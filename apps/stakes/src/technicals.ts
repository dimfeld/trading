import { Bar, BarTimeframe } from 'types';
import get from 'just-safe-get';
import ky from './ssr-ky';
import {
  LatestTechnicals,
  TechnicalCalculator,
  technicalCalculator,
} from 'options-analysis';
import { derived, Readable, writable } from 'svelte/store';
import { quoteLabel } from './quotes';
import type { QuotesData } from './quotes';

export type TechnicalsMap = Map<string, LatestTechnicals>;
export type TechnicalsConditionValue = string | number;
export enum TechnicalsConditionOp {
  lt = '<',
  gt = '>',
  lte = '<=',
  gte = '>=',
}
export interface TechnicalsCondition {
  l: TechnicalsConditionValue;
  op: string;
  r: TechnicalsConditionValue;
}

export const legacyMaKeyTranslator: { [key: string]: string | undefined } = {
  ma5: 'ema5',
  ma10: 'ema10',
  ma21: 'ema21',
  rsi: 'rsi20',
};

export function maValue(
  symbol: string,
  item: TechnicalsConditionValue,
  maData: TechnicalsMap,
  quotes: QuotesData
) {
  if (typeof item === 'string') {
    if (item === 'stock_price') {
      let quoteData = quotes.get(symbol);
      return quoteData && (quoteData.mark || quoteData.lastPrice);
    } else {
      item = legacyMaKeyTranslator[item] || item;
      return get(maData.get(symbol) || {}, item);
    }
  } else {
    return item;
  }
}

export function maValueText(
  symbol: string,
  item: TechnicalsConditionValue,
  maData: TechnicalsMap,
  quotes: QuotesData
) {
  if (item === 'stock_price') {
    return quoteLabel(quotes.get(symbol));
  }

  let value = maValue(symbol, item, maData, quotes);
  return typeof value === 'number' ? value.toFixed(2) : value;
}

const maValueLabels: { [key: string]: string | undefined } = {
  stock_price: 'Stock',
};

export function maValueLabel(field: string) {
  if (typeof field === 'number') {
    return field;
  }

  return maValueLabels[field] || field.toUpperCase();
}

export function maItemClass(
  symbol: string,
  condition: TechnicalsCondition,
  maData: TechnicalsMap,
  quotes: QuotesData
) {
  let left = maValue(symbol, condition.l, maData, quotes);
  let right = maValue(symbol, condition.r, maData, quotes);

  if (!left || !right) {
    console.dir({ symbol, condition, maData, left, right });
    return '';
  }

  let met = false;
  switch (condition.op) {
    case '>':
      met = left > right;
      break;

    case '>=':
      met = left >= right;
      break;

    case '<':
      met = left < right;
      break;

    case '<=':
      met = left <= right;
      break;
  }

  console.dir({ symbol, condition, met, left, right });
  return met ? 'bg-green-200' : 'bg-red-200';
}

const allConditionFields = [
  'stock_price',
  'ema5',
  'ema10',
  'ema21',
  'ma50',
  'ma200',
  'rsi20',
  'rsi14',
  'bollinger-upper-1sd',
  'bollinger-lower-1sd',
  'bollinger-upper-2sd',
  'bollinger-lower-2sd',
  'bollinger-upper-3sd',
  'bollinger-lower-3sd',
];

// TODO Update this with the full OpeningPosition type
export interface OpeningPosition {
  symbol: string;
  conditions: TechnicalsCondition[];
}

export function conditionFields(position: OpeningPosition) {
  let fields = new Set(
    (position.conditions || []).flatMap((condition) => {
      return [condition.l, condition.r]
        .filter((val) => typeof val === 'string')
        .map((f) => legacyMaKeyTranslator[f as string] || f);
    })
  );

  let result = allConditionFields.filter((f) => fields.has(f));
  console.dir({ symbol: position.symbol, result });
  return result;
}

export type TechnicalsStore = Readable<LatestTechnicals | null>;

export function technicalsStore(
  quotes: Readable<QuotesData>,
  bars: Readable<Bar[] | null>,
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

      let price = quote.mark || quote.lastPrice;
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
