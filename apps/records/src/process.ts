import * as _ from 'lodash';
import * as db from './db';
import * as bb from 'bluebird';
import * as debug_factory from 'debug';
import { ITrade, IPosition, IOptionLeg, TradeAndPosition, IStrategies, PositionChange, UnderlyingWithTrade, TradeMatches, DbData } from './types';
import { PositionSimulator, Change, MatchingPositionScore, matchPositions, optionInfoFromSymbol } from 'options-analysis';
import { position_for_unmatched_trade, print_trade_description } from './ui';
import { recalculate } from './position';

const debug = debug_factory('process');

const underlyingEquivalents = {
  RUTW: 'RUT',
  SPXW: 'SPX',
  NDXW: 'NDX',
};

export async function match_trades(trades : UnderlyingWithTrade[], db_data : DbData) {
  let open_positions = db_data.positions;
  debug(trades);

  // Match open positions to incoming trades
  let matched: PositionChange[] = await bb.mapSeries(trades, async (t) => {
    let symbol = underlyingEquivalents[t.underlying] || t.underlying;
    t.underlying = symbol;

    let symbol_positions = open_positions[symbol];
    if(!symbol_positions) {
       symbol_positions = open_positions[symbol] = [];
    }

    let trade = t.trade;
    debug("Matching", trade, symbol_positions);
    let matches = matchPositions(trade, symbol_positions);

    let position = await position_for_unmatched_trade({ matches, ...t }, symbol_positions, db_data);
    if(!position) {
      return;
    }
    let change = apply_trade_to_position({position, trade: t.trade});

    // Update the current position state with the new position.
    let existing = _.findIndex(symbol_positions, (p) => p.id === change.position.id);
    if(existing < 0) {
      symbol_positions.push(change.position);
    } else {
      symbol_positions[existing] = change.position;
    }

    debug("Matched trade to position", t.trade, position);

    return change;
  });

  return {
    open_positions,
    changes: _.compact(matched),
  };
}

function apply_trade_to_position({position, trade} : TradeAndPosition) : PositionChange {
  let simulator = new PositionSimulator(position.legs);
  let result = simulator.addLegs(trade.legs);

  debug("Applied", trade, position, result);

  let trade_type : Change;
  let all_same = _.every(result, (r) => r.change === result[0].change);
  if(all_same) {
    trade_type = result[0].change;
  }

  debug("sim legs", simulator.legs);
  let new_legs = simulator.getFlattenedList();

  let new_trades = position.trades.concat(trade);
  let new_position = {
    ...position,
    trades: new_trades,
    legs: new_legs,
    ...recalculate(new_trades),
  };

  if(!new_legs.length) {
    new_position.close_date = new Date(trade.traded);
  } else {
    // This happens sometimes when rolling legs through separate trades.
    new_position.close_date = null;
  }

  return {
    position: new_position,
    change: trade_type,
    trade,
  };
}

export async function process_trades(db_data : DbData, trades: UnderlyingWithTrade[]) {
  trades = _.sortBy(trades, (t) => (new Date(t.trade.traded).getTime()));
  let matched = await match_trades(trades, db_data);

  let outputTrades = matched.changes.map((m) => {
    return {
      position: m.position.id,
      ...m.trade,
    };
  });

  let updated_positions = _.chain(matched.changes)
    .map((change) => {
      print_trade_description(change, db_data.strategies);
      return change.position;
    })
    .groupBy('id')
    .map((positions) => {
      return _.maxBy(positions, (p) => _.get(p, ['trades', 'length'], 0));
    })
    .value();

  return db.write_positions(updated_positions, outputTrades);
}
