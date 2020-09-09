import * as _ from 'lodash';
import * as bb from 'bluebird';
import * as debug_factory from 'debug';
import { DbData } from 'types';

import {
  PositionSimulator,
  Change,
  MatchingPositionScore,
  matchPositions,
  optionInfoFromSymbol,
  applyTradeToPosition,
  PositionChange,
} from 'options-analysis';
import {
  UnderlyingWithTrade,
  position_for_unmatched_trade,
  print_trade_description,
} from './ui';
import { writePositions } from 'trading-data';

const debug = debug_factory('process');

const underlyingEquivalents = {
  RUTW: 'RUT',
  SPXW: 'SPX',
  NDXW: 'NDX',
};

export async function match_trades(
  trades: UnderlyingWithTrade[],
  db_data: DbData
) {
  let open_positions = db_data.positions;
  debug(trades);

  // Match open positions to incoming trades
  let matched: PositionChange[] = await bb.mapSeries(trades, async (t) => {
    let symbol = underlyingEquivalents[t.underlying] || t.underlying;
    t.underlying = symbol;

    let symbol_positions = open_positions[symbol];
    if (!symbol_positions) {
      symbol_positions = open_positions[symbol] = [];
    }

    let trade = t.trade;
    debug('Matching', trade, symbol_positions);
    let matches = matchPositions(trade, symbol_positions);

    let position = await position_for_unmatched_trade(
      { matches, ...t },
      symbol_positions,
      db_data
    );
    if (!position) {
      return;
    }
    let change = applyTradeToPosition(position, t.trade);

    // Update the current position state with the new position.
    let existing = _.findIndex(
      symbol_positions,
      (p) => p.id === change.position.id
    );
    if (existing < 0) {
      symbol_positions.push(change.position);
    } else {
      symbol_positions[existing] = change.position;
    }

    debug('Matched trade to position', t.trade, position);

    return change;
  });

  return {
    open_positions,
    changes: _.compact(matched),
  };
}

export async function process_trades(
  db_data: DbData,
  trades: UnderlyingWithTrade[]
) {
  trades = _.sortBy(trades, (t) => new Date(t.trade.traded).getTime());
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

  return writePositions(updated_positions, outputTrades);
}
