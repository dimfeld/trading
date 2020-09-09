"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.applyTradeToPosition = applyTradeToPosition;
exports.recalculateMoney = recalculateMoney;

var _position_simulator = require("./position_simulator");

var _debug = _interopRequireDefault(require("debug"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const debug = (0, _debug.default)('options-analysis:import_trades');

function applyTradeToPosition(position, trade) {
  let simulator = new _position_simulator.PositionSimulator(position.legs);
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

function recalculateMoney(trades) {
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