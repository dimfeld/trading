"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Api = void 0;
const Alpaca = require("@alpacahq/alpaca-trade-api");
const types_1 = require("types");
const statusMap = {
    new: types_1.TradeStatus.pending,
    accepted: types_1.TradeStatus.pending,
    pending_new: types_1.TradeStatus.pending,
    accepted_for_bidding: types_1.TradeStatus.pending,
    stopped: types_1.TradeStatus.active,
    rejected: types_1.TradeStatus.rejected,
    suspended: types_1.TradeStatus.pending,
    calculated: types_1.TradeStatus.active,
    partially_filled: types_1.TradeStatus.active,
    filled: types_1.TradeStatus.filled,
    done_for_day: types_1.TradeStatus.active,
    canceled: types_1.TradeStatus.canceled,
    expired: types_1.TradeStatus.canceled,
    replaced: types_1.TradeStatus.canceled,
    pending_cancel: types_1.TradeStatus.active,
    pending_replace: types_1.TradeStatus.active,
};
function request(fn) {
    return new Promise((resolve, reject) => {
        let tryIt = () => {
            fn()
                .then(resolve)
                .catch((e) => {
                var _a;
                if (((_a = e.response) === null || _a === void 0 ? void 0 : _a.statusCode) === 429) {
                    // Try again
                    setTimeout(tryIt, 1000);
                }
                else {
                    reject(e);
                }
            });
        };
        tryIt();
    });
}
class Api {
    constructor(options) {
        var _a;
        this.api = new Alpaca({
            keyId: options.key,
            secretKey: options.secret,
            paper: (_a = options.paper) !== null && _a !== void 0 ? _a : false,
            usePolygon: true,
        });
    }
    // Nothing to do here.
    init() { }
    async refreshAuth() { }
    async getAccount() {
        let data = await request(() => this.api.getAccount());
        return {
            id: data.id,
            buyingPower: +data.buying_power,
            cash: +data.cash,
            dayTradeCount: +data.daytrade_count,
            dayTradesRestricted: data.pattern_day_trader,
            isDayTrader: +data.equity < 25000,
            portfolioValue: +data.equity,
            maintenanceMargin: +data.maintenance_margin,
        };
    }
    async getBars(options) {
        let data = await request(() => this.api.getBars(options.timeframe, options.symbols.join(','), {
            start: options.start,
            end: options.end,
            limit: options.limit,
        }));
        let output = new Map();
        for (let key of data) {
            output.set(key, data[key].map((aBar) => {
                return {
                    open: +aBar.openPrice,
                    close: +aBar.closePrice,
                    high: +aBar.highPrice,
                    low: +aBar.lowPrice,
                    time: new Date(aBar.startEpochTime),
                };
            }));
        }
        return output;
    }
    async marketStatus() {
        let data = await request(() => this.api.getClock());
        return {
            open: data.open,
            nextOpen: new Date(data.next_open),
            nextClose: new Date(data.next_close),
        };
    }
    async getTrades(options = {}) {
        let reqOptions = {
            status: options.filled ? 'closed' : 'all',
            after: options.startDate,
            until: options.endDate,
        };
        let data = await request(() => this.api.getOrders(reqOptions));
        return data
            .map((trade) => {
            let price = Number(trade.filled_avg_price || trade.limit_price || trade.stop_price);
            if (options.filled && trade.status !== 'filled') {
                return null;
            }
            return {
                id: trade.id,
                status: statusMap[trade.status],
                traded: new Date(trade.filled_at ||
                    trade.canceled_at ||
                    trade.filled_at ||
                    trade.replaced_at ||
                    trade.submitted_at ||
                    trade.created_at),
                commissions: 0,
                price,
                legs: [
                    {
                        symbol: trade.symbol,
                        price,
                        size: +trade.qty,
                        filled: +trade.filled_qty,
                    },
                ],
            };
        })
            .filter(Boolean);
    }
    async getPositions() {
        let pos = await this.api.getPositions();
        return pos.map((p) => {
            return {
                symbol: p.symbol,
                price: +p.avg_entry_price,
                broker: types_1.BrokerChoice.alpaca,
                size: p.size === 'long' ? +p.qty : -p.qty,
            };
        });
    }
}
exports.Api = Api;
//# sourceMappingURL=index.js.map