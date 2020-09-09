"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Api = void 0;
const Alpaca = require("@alpacahq/alpaca-trade-api");
const types_1 = require("types");
const tradeTypeMap = {
    [types_1.OrderType.limit]: 'limit',
    [types_1.OrderType.market]: 'market',
    [types_1.OrderType.stop]: 'stop',
    [types_1.OrderType.stopLimit]: 'stop_limit',
};
const tradeDurationMap = {
    [types_1.OrderDuration.day]: 'day',
    [types_1.OrderDuration.gtc]: 'gtc',
};
const statusMap = {
    new: types_1.OrderStatus.pending,
    accepted: types_1.OrderStatus.pending,
    pending_new: types_1.OrderStatus.pending,
    accepted_for_bidding: types_1.OrderStatus.pending,
    stopped: types_1.OrderStatus.active,
    rejected: types_1.OrderStatus.rejected,
    suspended: types_1.OrderStatus.pending,
    calculated: types_1.OrderStatus.active,
    partially_filled: types_1.OrderStatus.active,
    filled: types_1.OrderStatus.filled,
    done_for_day: types_1.OrderStatus.active,
    canceled: types_1.OrderStatus.canceled,
    expired: types_1.OrderStatus.canceled,
    replaced: types_1.OrderStatus.canceled,
    pending_cancel: types_1.OrderStatus.active,
    pending_replace: types_1.OrderStatus.active,
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
function convertAlpacaOrder(trade) {
    let price = Number(trade.filled_avg_price || trade.limit_price || trade.stop_price);
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
    end() { }
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
        for (let key in data) {
            output.set(key, data[key].map((aBar) => {
                return {
                    open: +aBar.openPrice,
                    close: +aBar.closePrice,
                    high: +aBar.highPrice,
                    low: +aBar.lowPrice,
                    volume: +aBar.volume,
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
    async getOrders(options = {}) {
        let reqOptions = {
            status: options.filled ? 'closed' : 'all',
            after: options.startDate,
            until: options.endDate,
        };
        let data = await request(() => this.api.getOrders(reqOptions));
        return data
            .map((trade) => {
            if (options.filled && trade.status !== 'filled') {
                return null;
            }
            return convertAlpacaOrder(trade);
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
                size: p.side === 'long' ? +p.qty : -p.qty,
            };
        });
    }
    async createOrder(order) {
        var _a, _b, _c, _d, _e, _f;
        if (order.legs.length !== 1) {
            // May be able to relax this at some point?
            throw new Error('Alpaca orders must have only one leg');
        }
        let orderClass;
        if (order.linkedStopLoss && order.linkedTakeProfit) {
            orderClass = 'bracket';
        }
        else if (order.linkedStopLoss || order.linkedTakeProfit) {
            orderClass = 'oto';
        }
        let orderType = tradeTypeMap[order.type];
        if (!orderType) {
            throw new Error(`Unsupported order type ${order.type}`);
        }
        let tif = tradeDurationMap[order.duration || types_1.OrderDuration.day];
        if (!tif) {
            throw new Error(`Unsupported order duration ${order.duration}`);
        }
        let linkedTakeProfit;
        if (order.linkedTakeProfit) {
            linkedTakeProfit = {
                limit_price: (_a = order.linkedTakeProfit.limitPrice) === null || _a === void 0 ? void 0 : _a.toFixed(2),
            };
        }
        let linkedStopLoss;
        if (order.linkedStopLoss) {
            linkedStopLoss = {
                stop_price: (_b = order.linkedStopLoss.stopPrice) === null || _b === void 0 ? void 0 : _b.toFixed(2),
                limit_price: (_c = order.linkedStopLoss.limitPrice) === null || _c === void 0 ? void 0 : _c.toFixed(2),
            };
        }
        let size = order.legs[0].size;
        let result = await this.api.createOrder({
            symbol: order.legs[0].symbol,
            side: size > 0 ? 'buy' : 'sell',
            qty: Math.abs(size).toString(),
            time_in_force: tif,
            type: orderType,
            extended_hours: (_d = order.extendedHours) !== null && _d !== void 0 ? _d : false,
            limit_price: order.type === types_1.OrderType.limit || order.type === types_1.OrderType.stopLimit
                ? (_e = order.price) === null || _e === void 0 ? void 0 : _e.toFixed(2) : undefined,
            stop_price: order.type === types_1.OrderType.stop || order.type === types_1.OrderType.stopLimit
                ? (_f = order.stopPrice) === null || _f === void 0 ? void 0 : _f.toFixed(2) : undefined,
            take_profit: linkedTakeProfit,
            stopLoss: linkedStopLoss,
        });
        return convertAlpacaOrder(result);
    }
}
exports.Api = Api;
//# sourceMappingURL=index.js.map