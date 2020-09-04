import { db, pgp } from '../api/services';
import { EntityDef } from '../state_manager/sync/lwwServer';
import { OptionLeg, TradeLeg } from 'options-analysis';

const ColumnSet = pgp.helpers.ColumnSet;

const positions = new ColumnSet(
  [
    { name: 'id', cnd: true },
    { name: 'version', cnd: true },
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
    { name: 'version', cnd: true },
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
    { name: 'id', cnd: true },
    { name: 'version', cnd: true },
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
    { name: 'id', cnd: true, cast: 'int' },
    { name: 'version', cnd: true },
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

const tags = new ColumnSet(
  [
    { name: 'id', cnd: true, cast: 'int' },
    { name: 'version', cnd: true },
    'name',
    'color',
  ],
  { table: 'tags' }
);

export const entities: { [key: string]: EntityDef<any> } = {
  positions: {
    singleton: false,
    columns: positions,
  },
  potential_positions: {
    singleton: false,
    columns: potentialPositions,
  },
  trades: {
    singleton: false,
    columns: trades,
  },
  strategies: {
    singleton: false,
    idIsInt: true,
    columns: strategies,
  },
  tags: {
    singleton: false,
    idIsInt: true,
    columns: tags,
  },
};

export async function getPositionsAndTrades(conditions: string, args = {}) {
  let results = await db.query(
    `SELECT positions.id, positions.tags, symbol, strategy, open_date, close_date, cost_basis, buying_power, profit, positions.legs, note, broker, structure, positions.version, jsonb_agg(row_to_json(t)) as trades
    FROM positions
    LEFT JOIN trades t on t.position=positions.id
    WHERE ${conditions}
    GROUP BY positions.id;`,
    args
  );

  let output: _.Dictionary<Position> = {};
  for (let result of results) {
    output[result.id] = result;
  }

  return output;
}
