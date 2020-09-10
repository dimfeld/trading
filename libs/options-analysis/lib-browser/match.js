import sorter from 'sorters';
export function matchPositions(trade, positions) {
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
  }).filter(x => x.score > 0).sort(sorter({
    value: 'score',
    descending: true
  }));
  return matched;
}
//# sourceMappingURL=match.js.map