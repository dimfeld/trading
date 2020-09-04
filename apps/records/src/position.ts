import * as _ from 'lodash';
import { ITrade } from "./types";

export function recalculate(trades : ITrade[]) {
  let long = trades[0].gross < 0;
  return _.reduce(trades || [], (acc, trade) => {
    if((long && trade.gross < 0) || (!long && trade.gross > 0)) {
      acc.cost_basis += trade.gross;
    }

    acc.profit += trade.gross;
    return acc;
  }, { cost_basis: 0, profit: 0 });
}
