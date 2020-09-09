"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addTrades = exports.updateMultiplePositions = exports.updatePosition = exports.addNewPositions = exports.tradeColumns = exports.positionColumns = exports.loadDb = void 0;
const debug_factory = require("debug");
const _ = require("lodash");
const config = require("./config");
const services_1 = require("./services");
const debug = debug_factory('positions');
async function loadDb() {
    let [tags, strategies, positions] = await services_1.db.multi(`
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
exports.loadDb = loadDb;
exports.positionColumns = new services_1.pgp.helpers.ColumnSet([
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
], { table: 'positions' });
exports.tradeColumns = new services_1.pgp.helpers.ColumnSet([
    { name: 'id', cnd: true },
    'position',
    { name: 'legs', mod: ':json', cast: 'jsonb' },
    { name: 'tags', mod: ':json', cast: 'int[]' },
    'gross',
    'traded',
    'commissions',
], { table: 'trades' });
const updatePositionFields = exports.positionColumns.columns
    .map((x) => x.name)
    .filter((x) => x !== 'id');
function addNewPositions(positions, trades, tx) {
    let insertPositions = services_1.pgp.helpers.insert(positions, exports.positionColumns, config.postgres.tables.positions);
    let updatePositions = _.map(updatePositionFields, (f) => `${services_1.pgp.as.name(f)}=EXCLUDED.${services_1.pgp.as.name(f)}`).join(', ');
    let insertTrades = services_1.pgp.helpers.insert(trades, exports.tradeColumns, config.postgres.tables.trades);
    let query = `${insertPositions}
    ON CONFLICT (id) DO UPDATE SET ${updatePositions};
    ${insertTrades};`;
    debug(query);
    return (tx || services_1.db).query(query);
}
exports.addNewPositions = addNewPositions;
function updatePosition(options, tx) {
    let presentColumns = exports.positionColumns.columns.filter((c) => options[c.name] !== undefined);
    let query = services_1.pgp.helpers.update(options, presentColumns, exports.positionColumns.table) +
        ` WHERE id=$[id]`;
    return (tx || services_1.db).query(query, { id: options.id });
}
exports.updatePosition = updatePosition;
function updateMultiplePositions(keys, positions, tx) {
    let presentColumns = exports.positionColumns.columns.filter((c) => keys.includes(c.name));
    let query = services_1.pgp.helpers.update(positions, presentColumns, exports.positionColumns.table) +
        ` WHERE t.id=v.id`;
    return (tx || services_1.db).query(query);
}
exports.updateMultiplePositions = updateMultiplePositions;
function addTrades(trades, tx) {
    let query = services_1.pgp.helpers.insert(trades, exports.tradeColumns);
    return (tx || services_1.db).query(query);
}
exports.addTrades = addTrades;
//# sourceMappingURL=positions.js.map