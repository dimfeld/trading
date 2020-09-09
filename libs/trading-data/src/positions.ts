import * as debug_factory from 'debug';
import * as _ from 'lodash';
import * as config from './config';
import { pgp, db } from './services';
import { DbData, DbPosition, DbTrade } from 'types';
import { ITask } from 'pg-promise';

const debug = debug_factory('positions');

export async function loadDb(): Promise<DbData> {
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

export const positionColumns = new pgp.helpers.ColumnSet(
  [
    { name: 'id', cnd: true },
    { name: 'tags', cast: 'int[]' },
    'symbol',
    'strategy',
    { name: 'open_date', cast: 'date' },
    { name: 'close_date', cast: 'date' },
    'cost_basis',
    'buying_power',
    'profit',
    { name: 'legs', mod: ':json', cast: 'jsonb' },
    'note',
    'broker',
    { name: 'structure', mod: ':json', cast: 'jsonb' },
  ],
  { table: 'positions' }
);

export const tradeColumns = new pgp.helpers.ColumnSet(
  [
    { name: 'id', cnd: true },
    'position',
    { name: 'legs', mod: ':json', cast: 'jsonb' },
    { name: 'tags', mod: ':json', cast: 'int[]' },
    'gross',
    'traded',
    'commissions',
  ],
  { table: 'trades' }
);

const updatePositionFields = positionColumns.columns
  .map((x) => x.name)
  .filter((x) => x !== 'id');

export function writePositions(
  positions: DbPosition[],
  trades: DbTrade[],
  tx?: ITask<any>
) {
  let insertPositions = pgp.helpers.insert(
    positions,
    positionColumns,
    config.postgres.tables.positions
  );
  let updatePositions = _.map(
    updatePositionFields,
    (f) => `${pgp.as.name(f)}=EXCLUDED.${pgp.as.name(f)}`
  ).join(', ');

  let insertTrades = pgp.helpers.insert(
    trades,
    tradeColumns,
    config.postgres.tables.trades
  );

  let query = `${insertPositions}
    ON CONFLICT (id) DO UPDATE SET ${updatePositions};
    ${insertTrades};`;

  debug(query);
  return (tx || db).query(query);
}

export type PositionUpdateOptions = Partial<
  Omit<DbPosition, 'symbol' | 'open_date'>
>;

export function updatePosition(
  options: PositionUpdateOptions,
  tx?: ITask<any>
) {
  let presentColumns = positionColumns.columns.filter(
    (c) => options[c.name] !== undefined
  );

  let query =
    pgp.helpers.update(options, presentColumns, positionColumns.table) +
    ` WHERE id=$[id]`;
  return (tx || db).query(query, { id: options.id });
}

export function updateMultiplePositions(
  keys: string[],
  positions: PositionUpdateOptions[],
  tx?: ITask<any>
) {
  let presentColumns = positionColumns.columns.filter((c) =>
    keys.includes(c.name)
  );

  let query =
    pgp.helpers.update(positions, presentColumns, positionColumns.table) +
    ` WHERE t.id=v.id`;
  return (tx || db).query(query);
}

export function addTrades(trades: DbTrade[], tx?: ITask<any>) {
  let query = pgp.helpers.insert(trades, tradeColumns);
  return (tx || db).query(query);
}
