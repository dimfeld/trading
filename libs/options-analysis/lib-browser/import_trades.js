import { PositionSimulator } from './position_simulator';
import debugMod from 'debug';
const debug = debugMod('options-analysis:import_trades');
export function orderGross(order) {
  return order.legs.reduce((acc, leg) => {
    let multiplier = leg.symbol.length > 6 ? 100 : 1;
    return acc + -leg.size * leg.price * multiplier;
  }, 0);
}
export function orderToDbTrade(order) {
  let trade = {
    id: order.id,
    commissions: order.commissions,
    traded: order.traded,
    gross: orderGross(order),
    tags: [],
    legs: order.legs.map(leg => {
      return { ...leg,
        price: leg.price ?? null
      };
    }),
    price_each: order.price
  };
  let underlying = order.legs[0].symbol.slice(0, 6).trim();
  return {
    underlying,
    trade,
    broker: order.broker
  };
}
export function applyTradeToPosition(position, trade) {
  let simulator = new PositionSimulator(position.legs);
  let result = simulator.addLegs(trade.legs);
  debug('Applied', trade, position, result);
  let trade_type;
  let all_same = result.every(r => r.change === result[0].change);

  if (all_same) {
    trade_type = result[0].change;
  }

  debug('sim legs', simulator.legs);
  let new_legs = simulator.getFlattenedList();
  let new_trades = position.trades.concat(trade);
  let new_position = { ...position,
    trades: new_trades,
    legs: new_legs,
    ...recalculateMoney(new_trades)
  };

  if (!new_legs.length) {
    new_position.close_date = new Date(trade.traded);
  } else {
    // This happens sometimes when rolling legs through separate trades.
    new_position.close_date = null;
  }

  return {
    position: new_position,
    change: trade_type,
    trade
  };
}
export function recalculateMoney(trades) {
  let long = trades[0].gross < 0;
  return trades.reduce((acc, trade) => {
    if (long && trade.gross < 0 || !long && trade.gross > 0) {
      acc.cost_basis += trade.gross;
    }

    acc.profit += trade.gross;
    return acc;
  }, {
    cost_basis: 0,
    profit: 0
  });
}
//# sourceMappingURL=import_trades.js.map