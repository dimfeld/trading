import { db, pgp } from '../api/services';
import { OptionLeg, TradeLeg } from 'options-analysis';
import index from 'just-index';

const ColumnSet = pgp.helpers.ColumnSet;

let idColumnSet = new ColumnSet([{ name: 'id', cnd: true }]);

let idIntColumnSet = new ColumnSet([{ name: 'id', cnd: true, cast: 'int' }]);

const positions = new ColumnSet(
  [
    'tags',
    'symbol',
    'strategy',
    'open_date',
    'close_date',
    'cost_basis',
    'buying_power',
    'profit',
    { name: 'legs', mod: ':json' },
    'note',
    'broker',
    { name: 'structure', mod: ':json' },
  ],
  { table: 'positions' }
);

export interface DbPosition {
  id: string;
  tags: string[];
  symbol: string;
  strategy: number;
  open_date: Date;
  close_date: Date | null;
  cost_basis: number;
  buying_power: number;
  profit: number;
  legs: OptionLeg[];
  note?: string;
  broker?: string;
  structure?: any;

  trades?: DbTrade[];
}

const potentialPositions = new ColumnSet(
  [
    { name: 'id', cnd: true },
    'symbol',
    'source',
    'strategy',
    { name: 'structure', mod: ':json' },
    'expires',
    { name: 'notes', mod: ':json' },
    'opened',
  ],
  { table: 'potential_positions' }
);

const trades = new ColumnSet(
  [
    'position',
    { name: 'legs', mod: ':json' },
    'tags',
    'gross',
    'traded',
    'commissions',
  ],
  { table: 'trades' }
);

export interface DbTrade {
  id: string;
  position: string;
  legs: TradeLeg[];
  tags: string[] | null;
  gross: number;
  traded: Date;
  commissions: number;
}

const strategies = new ColumnSet(
  [
    'name',
    'description',
    'color',
    { name: 'structure', mod: ':json' },
    'sort',
    'tags',
    'short_name',
  ],
  { table: 'strategies' }
);

const tags = new ColumnSet(['name', 'color'], { table: 'tags' });

export const entities = {
  positions: {
    singleton: false,
    idIsInt: false,
    insertColumns: positions,
    columns: idColumnSet.merge(positions),
    table: 'positions',
  },
  potential_positions: {
    singleton: false,
    idIsInt: false,
    insertColumns: potentialPositions,
    columns: potentialPositions,
    table: 'potential_positions',
  },
  trades: {
    singleton: false,
    idIsInt: false,
    insertColumns: trades,
    columns: idColumnSet.merge(trades),
    table: 'trades',
  },
  strategies: {
    singleton: false,
    idIsInt: true,
    insertColumns: strategies,
    columns: idIntColumnSet.merge(strategies),
    table: 'strategies',
  },
  tags: {
    singleton: false,
    idIsInt: true,
    insertColumns: tags,
    columns: idIntColumnSet.merge(tags),
    table: 'tags',
  },
};

export interface ReadOptions {
  entity: keyof typeof entities;
  fields?: Record<string, any>;
  where?: string;
}

export async function read(options: ReadOptions) {
  let entityDef = entities[options.entity];
  let query = `SELECT ${entityDef.columns.names} FROM ${entityDef.table}`;

  let whereClause = [];
  if (options.fields) {
    let conditions = Object.entries(options.fields)
      .map(([k, v]) => {
        if (Array.isArray(v)) {
          return `${pgp.as.name(k)} = ANY($[k])`;
        } else {
          return `${pgp.as.name(k)}=$[k]`;
        }
      })
      .join(' AND ');

    whereClause.push(...conditions);
  }

  if (options.where) {
    whereClause.push(options.where);
  }

  if (whereClause.length) {
    query += ` WHERE ${whereClause.join(' AND ')}`;
  }

  let results = await db.query(query);
  return index(results, 'id');
}

export function create<T extends object>(
  entity: keyof typeof entities,
  object: T
) {
  let query = pgp.helpers.insert(object, entities[entity].insertColumns);
  query += ' RETURNING *';
  return db.one<T>(query);
}

export function update<T extends object>(
  entity: keyof typeof entities,
  id: string | number,
  object: T
) {
  let query = pgp.helpers.update(object, entities[entity].columns);
  query += ` WHERE id=$[id] RETURNING *`;
  return db.one<T>(query, { id });
}

export function del(entity: keyof typeof entities, id: string | int) {
  let e = entities[entity];
  let query = `DELETE FROM ${e.table} WHERE id=$[id]`;
  return db.none(query, { id: e.idIsInt ? +id : id });
}

export async function getPositionsAndTrades(conditions: string, args = {}) {
  let results = await db.query(
    `SELECT positions.id, positions.tags, symbol, strategy, open_date, close_date, cost_basis, buying_power, profit, positions.legs, note, broker, structure, positions.version, jsonb_agg(row_to_json(t)) as trades
    FROM positions
    LEFT JOIN trades t on t.position=positions.id
    WHERE ${conditions}
    GROUP BY positions.id;`,
    args
  );

  return index(results, 'id');
}

export async function updatePositionAndTrades(
  id: string,
  position: DbPosition
) {
  let positionUpdate =
    pgp.helpers.update(position, entities.positions.columns) +
    ` WHERE id=$[positionId]`;

  let tradesUpdate: string | undefined;
  if (position.trades?.length) {
    let conflictUpdate = entities.trades.columns.columns
      .filter((c) => !c.cnd)
      .map((c) => `${c.name}=EXCLUDED.${c.name}`)
      .join(', ');
    tradesUpdate =
      pgp.helpers.insert(position.trades, entities.trades.columns) +
      ` ON CONFLICT DO UPDATE SET ${conflictUpdate}`;
  }

  let queries = pgp.helpers.concat([positionUpdate, tradesUpdate || '']);

  return db.tx((tx) => tx.query(queries, { positionId: id }));
}
