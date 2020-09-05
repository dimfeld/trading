"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Brokers = void 0;
const tda = require("./tda");
const alpaca = require("./alpaca");
const types_1 = require("types");
const orders_1 = require("./orders");
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
    waitForOrders(broker, options) {
        let api = this.resolveBrokerChoice(broker);
        return orders_1.waitForOrders(api, options);
    }
}
exports.Brokers = Brokers;
//# sourceMappingURL=index.js.map