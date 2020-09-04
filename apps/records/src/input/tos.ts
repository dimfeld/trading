import * as _ from 'lodash';
import * as debugMod from 'debug';
import { UnderlyingWithTrade, ITrade } from "../types";

const debug = debugMod('tos');

// The format returned by tda_api.getTrades
interface TosTrade {
  id : string;
  traded: string;
  price : number;
  commissions : number;
  legs : TosLeg[];
}

interface TosLeg {
  symbol: string;
  size: number;
  price: number;
}

function parseTrade(trade: TosTrade): UnderlyingWithTrade {
  debug(trade);
  let result: ITrade = {
    id: trade.id.toString(),
    commissions: trade.commissions,
    gross: 0,
    legs: trade.legs,
    tags: [],
    traded: new Date(trade.traded).toISOString(),
  };

  let legAmounts = _.map(trade.legs, (leg) => {
    let multiplier = leg.symbol.length > 6 ? 100 : 1;
    return -leg.size * leg.price * multiplier;
  });

  result.gross = _.sum(legAmounts);

  let underlying = trade.legs[0].symbol.slice(0, 6).trim();

  return {
    underlying,
    trade: result,
  };
}

export function get_trades(trades : TosTrade[])  {
  return _.map(trades, parseTrade);
}