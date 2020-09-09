"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postgres = void 0;
exports.postgres = {
    url: process.env.TRADING_PG || 'postgres://trading@localhost/trading',
    tables: {
        positions: 'positions',
        trades: 'trades',
        tags: 'tags',
        historical_equity_prices: 'historical_equity_prices',
    },
};
//# sourceMappingURL=config.js.map