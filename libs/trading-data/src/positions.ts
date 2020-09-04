import * as debug_factory from 'debug';
import * as _ from 'lodash';
import * as config from './config';
import { pgp, db } from './services';
import { DbData, IPosition } from './types';

const debug = debug_factory('positions');

export async function load() : Promise<DbData> {
  let [tags, strategies, positions] = await db.multi(`
    SELECT * FROM tags ORDER BY name;
    SELECT * FROM strategies ORDER BY sort desc, name;
    SELECT * FROM ${config.postgres.tables.positions} WHERE close_date IS NULL ORDER BY open_date;
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
    'profit_target_pct',
    'stop_loss_pct',
    'cost_basis',
    'buying_power',
    'profit',
    { name: 'trades', mod: ':json' },
    { name: 'legs', mod: ':json' },
    'note',
    'broker',
    { name: 'algorithm', mod: ':json' },
  ],
);

let update_position_fields = column_set.columns.map((x) => x.name).filter((x) => x !== 'id')

export function write_positions(positions : IPosition[]) {
  let insert = pgp.helpers.insert(positions, column_set, config.postgres.tables.positions);
  let update = _.map(update_position_fields, (f) => `${pgp.as.name(f)}=EXCLUDED.${pgp.as.name(f)}`).join(', ');
  let query = `${insert}
    ON CONFLICT (id) DO UPDATE SET ${update}`;

  debug(query);
  return db.query(query);
}
