"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tradeColumns = exports.writePositions = exports.positionColumns = exports.loadDb = void 0;
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
    'id',
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
let updatePositionFields = exports.positionColumns.columns
    .map((x) => x.name)
    .filter((x) => x !== 'id');
function writePositions(positions, trades) {
    let insertPositions = services_1.pgp.helpers.insert(positions, exports.positionColumns, config.postgres.tables.positions);
    let updatePositions = _.map(updatePositionFields, (f) => `${services_1.pgp.as.name(f)}=EXCLUDED.${services_1.pgp.as.name(f)}`).join(', ');
    let insertTrades = services_1.pgp.helpers.insert(trades, exports.tradeColumns, config.postgres.tables.trades);
    let query = `${insertPositions}
    ON CONFLICT (id) DO UPDATE SET ${updatePositions};
    ${insertTrades};`;
    debug(query);
    return services_1.db.query(query);
}
exports.writePositions = writePositions;
exports.tradeColumns = new services_1.pgp.helpers.ColumnSet([
    { name: 'id', cnd: true },
    'position',
    { name: 'legs', mod: ':json' },
    { name: 'tags', mod: ':json' },
    'gross',
    'traded',
    'commissions',
]);
//# sourceMappingURL=positions.js.map