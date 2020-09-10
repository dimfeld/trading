export interface TradeLeg {
  size: number;
  price: number;
  symbol: string;
}

export interface Trade {
  price_each: number;
  gross: number;
  legs: TradeLeg[];
}

export interface PositionLegInfo {
  openingIsLong: boolean;
  totalBasis: number;
  maxLegs: number;
  openBasis: number;
  openLegs: number;
  realized: number;
  multiplier: number;
}

export interface Position<T extends Trade> {
  symbol: string;
  legs: OptionLeg[];
  trades: T[];
}

export interface OptionLeg {
  id?: string;
  symbol: string;
  size: number;
  price?: number;
}

export interface OptionInfo {
  id?: string;
  underlying: string;
  strike: number;
  expiration: string;
  call: boolean;
  size?: number;
}

export function occExpirationFromDate(d: Date) {
  let year = d.getUTCFullYear().toString().slice(2);
  let month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  let day = d.getUTCDate().toString().padStart(2, '0');
  return `${year}${month}${day}`;
}

export function dateFromOccExpiration(e: string) {
  let year = '20' + e.slice(0, 2);
  return new Date(+year, +e.slice(2, 4) - 1, +e.slice(4));
}

export function fullSymbol(ol: OptionInfo, padSymbol = true) {
  if (typeof ol.call === 'boolean' && ol.strike) {
    let legType = ol.call ? 'C' : 'P';
    let strike = (ol.strike * 1000).toString().padStart(8, '0').slice(0, 8);
    let symbol = padSymbol ? ol.underlying.padEnd(6, ' ') : ol.underlying;
    return `${symbol}${ol.expiration}${legType}${strike}`;
  } else {
    // Otherwise it's just an equity.
    return ol.underlying;
  }
}

export function optionInfoFromSymbol(symbol: string): OptionInfo {
  let underlying = symbol.slice(0, 6).trim();
  if (symbol.length <= 6) {
    return {
      underlying,
      expiration: undefined,
      call: undefined,
      strike: undefined,
    };
  }

  return {
    underlying,
    expiration: symbol.slice(6, 12),
    call: symbol[12] === 'C',
    strike: +symbol.slice(13).trimStart() / 1000,
  };
}

export function optionInfoFromLeg(leg: OptionLeg): OptionInfo {
  return {
    id: leg.id,
    size: leg.size,
    ...optionInfoFromSymbol(leg.symbol),
  };
}
