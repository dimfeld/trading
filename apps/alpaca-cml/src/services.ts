import * as Alpaca from '@alpacahq/alpaca-trade-api';
import * as pgpMod from 'pg-promise';

export const pgp = pgpMod();
export const db = pgp('postgres://trading@localhost/trading');

const token = require('../paper.json');
// const token = require('./key.json');

export const alpaca = new Alpaca({
  keyId: token.key,
  secretKey: token.secret,
  paper: true,
  usePolygon: true,
});

export const positionColumns = new pgp.helpers.ColumnSet([
  { name: 'id', cnd: true },
  { name: 'tags', cast: 'int[]' },
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
]);

export const tradeColumns = new pgp.helpers.ColumnSet([
  { name: 'id', cnd: true },
  'position',
  { name: 'legs', mod: ':json' },
  { name: 'tags', mod: ':json' },
  'gross',
  'traded',
  'commissions',
]);
