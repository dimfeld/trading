"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBrokers = exports.Brokers = void 0;
const tda = require("./tda");
const alpaca = require("./alpaca");
const types_1 = require("types");
const orders_1 = require("./orders");
__exportStar(require("./default_auth"), exports);
/** A class that arbitrates requests through multiple brokers */
class Brokers {
    constructor(options) {
        var _a;
        if (options.tda) {
            this.tda = new tda.Api(options.tda.auth, (_a = options.tda.autorefresh) !== null && _a !== void 0 ? _a : true);
        }
        if (options.alpaca) {
            this.alpaca = new alpaca.Api(options.alpaca);
        }
    }
    init() {
        var _a, _b;
        return Promise.all([(_a = this.alpaca) === null || _a === void 0 ? void 0 : _a.init(), (_b = this.tda) === null || _b === void 0 ? void 0 : _b.init()]);
    }
    getAccount(broker) {
        return Promise.all(this.resolveMaybeBrokerChoice(broker).map((api) => api.getAccount()));
    }
    getBars(options) {
        if (!this.alpaca) {
            return Promise.reject(new Error('getBars requires the Alpaca broker'));
        }
        return this.alpaca.getBars(options);
    }
    async getPositions(broker) {
        let pos = await Promise.all(this.resolveMaybeBrokerChoice(broker).map((api) => api.getPositions()));
        return pos.flat();
    }
    getQuotes(symbols) {
        return this.tda.getQuotes(symbols);
    }
    getOptionChain(options) {
        return this.tda.getOptionChain(options);
    }
    marketStatus() {
        return this.alpaca.marketStatus();
    }
    resolveBrokerChoice(choice) {
        switch (choice) {
            case types_1.BrokerChoice.alpaca:
                return this.alpaca;
            case types_1.BrokerChoice.tda:
                return this.tda;
        }
    }
    resolveMaybeBrokerChoice(choice) {
        return choice
            ? [this.resolveBrokerChoice(choice)]
            : [this.tda, this.alpaca].filter(Boolean);
    }
    createOrder(broker, options) {
        let api = this.resolveBrokerChoice(broker);
        return api.createOrder(options);
    }
    waitForOrders(broker, options) {
        let api = this.resolveBrokerChoice(broker);
        return orders_1.waitForOrders(api, options);
    }
}
exports.Brokers = Brokers;
async function createBrokers(options) {
    let api = new Brokers(options);
    await api.init();
    return api;
}
exports.createBrokers = createBrokers;
//# sourceMappingURL=index.js.map