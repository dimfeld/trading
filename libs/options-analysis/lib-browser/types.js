export function occExpirationFromDate(d) {
  let year = d.getUTCFullYear().toString().slice(2);
  let month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  let day = d.getUTCDate().toString().padStart(2, '0');
  return `${year}${month}${day}`;
}
export function dateFromOccExpiration(e) {
  let year = '20' + e.slice(0, 2);
  return new Date(+year, +e.slice(2, 4) - 1, +e.slice(4));
}
export function fullSymbol(ol, padSymbol = true) {
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
export function optionInfoFromSymbol(symbol) {
  let underlying = symbol.slice(0, 6).trim();

  if (symbol.length <= 6) {
    return {
      underlying,
      expiration: undefined,
      call: undefined,
      strike: undefined
    };
  }

  return {
    underlying,
    expiration: symbol.slice(6, 12),
    call: symbol[12] === 'C',
    strike: +symbol.slice(13).trimStart() / 1000
  };
}
export function optionInfoFromLeg(leg) {
  return {
    id: leg.id,
    size: leg.size,
    ...optionInfoFromSymbol(leg.symbol)
  };
}
//# sourceMappingURL=types.js.map