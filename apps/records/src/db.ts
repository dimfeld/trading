import * as debug_factory from 'debug';
import * as _ from 'lodash';
import * as pgp_mod from 'pg-promise';

import * as config from './config';
import { DbData, IPosition, ITradeObject } from './types';

const debug = debug_factory('db');

export var pgp = pgp_mod();
export var db = pgp(config.postgres.url);

export async function load() : Promise<DbData> {
  let [tags, strategies, positions] = await db.multi(`
    SELECT * FROM tags ORDER BY name;
    SELECT * FROM strategies ORDER BY sort desc, name;

    SELECT positions.*, jsonb_agg(row_to_json(trades)) trades
    FROM ${config.postgres.tables.positions} positions
    JOIN ${config.postgres.tables.trades} trades ON trades.position=positions.id
    WHERE close_date IS NULL
    GROUP BY positions.id
    ORDER BY open_date;
  `);

  let grouped_positions = _.groupBy(positions, 'symbol');

  return {
    tags: _.keyBy(tags, 'id'),
    sorted_tags: tags,
    strategies: _.keyBy(strategies, 'id'),
    sorted_strategies: strategies,
    positions: grouped_positions,
  };
}

const column_set = new pgp.helpers.ColumnSet([
    'id',
    { name: 'tags', cast: 'int[]'},
    'symbol',
    'strategy',
    'open_date',
    'close_date',
    'cost_basis',
    'buying_power',
    'profit',
    // { name: 'trades', mod: ':json' },
    { name: 'legs', mod: ':json' },
    'note',
    'broker',
    { name: 'structure', mod: ':json' },
  ],
);

const tradeColumnSet = new pgp.helpers.ColumnSet([
  'id', 'position',
  { name: 'legs', mod: ':json'},
  { name: 'tags', mod: ':json'},
  'gross', 'traded', 'commissions',
]);

let update_position_fields = column_set.columns.map((x) => x.name).filter((x) => x !== 'id')

export function write_positions(positions : IPosition[], trades : ITradeObject[]) {
  let insertPositions = pgp.helpers.insert(positions, column_set, config.postgres.tables.positions);
  let updatePositions = _.map(update_position_fields, (f) => `${pgp.as.name(f)}=EXCLUDED.${pgp.as.name(f)}`).join(', ');

  let insertTrades = pgp.helpers.insert(trades, tradeColumnSet, config.postgres.tables.trades);

  let query = `${insertPositions}
    ON CONFLICT (id) DO UPDATE SET ${updatePositions};
    ${insertTrades};`;

  debug(query);
  return db.query(query);
}
