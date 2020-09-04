"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tradeColumns = exports.write_positions = exports.load = void 0;
const debug_factory = require("debug");
const _ = require("lodash");
const config = require("./config");
const services_1 = require("./services");
const debug = debug_factory('positions');
async function load() {
    let [tags, strategies, positions] = await services_1.db.multi(`
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
exports.load = load;
const positionColumns = new services_1.pgp.helpers.ColumnSet([
    'id',
    { name: 'tags', cast: 'int[]' },
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
]);
let update_position_fields = positionColumns.columns.map((x) => x.name).filter((x) => x !== 'id');
function write_positions(positions) {
    let insert = services_1.pgp.helpers.insert(positions, positionColumns, config.postgres.tables.positions);
    let update = _.map(update_position_fields, (f) => `${services_1.pgp.as.name(f)}=EXCLUDED.${services_1.pgp.as.name(f)}`).join(', ');
    let query = `${insert}
    ON CONFLICT (id) DO UPDATE SET ${update}`;
    debug(query);
    return services_1.db.query(query);
}
exports.write_positions = write_positions;
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