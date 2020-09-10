"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.matchPositions = matchPositions;

var _sorters = _interopRequireDefault(require("sorters"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function matchPositions(trade, positions) {
  let legs = trade.legs;
  let matched = positions.map(position => {
    let overlapping = legs.reduce((acc, leg) => {
      let found_leg = position.legs.find(p_leg => p_leg.symbol === leg.symbol);

      if (found_leg) {
        acc += 1;
      }

      return acc;
    }, 0);
    return {
      score: overlapping / position.legs.length,
      overlapping,
      position
    };
  }).filter(x => x.score > 0).sort((0, _sorters.default)({
    value: 'score',
    descending: true
  }));
  return matched;
}
//# sourceMappingURL=match.js.map