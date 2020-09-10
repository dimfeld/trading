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
const default_auth_1 = require("./default_auth");
__exportStar(require("./default_auth"), exports);
/** A class that arbitrates requests through multiple brokers */
class Brokers {
    constructor({ tda: tdaOptions, alpaca: alpacaOptions } = {}) {
        var _a;
        tdaOptions = tdaOptions !== null && tdaOptions !== void 0 ? tdaOptions : { auth: default_auth_1.defaultTdaAuth(), autorefresh: true };
        alpacaOptions = alpacaOptions !== null && alpacaOptions !== void 0 ? alpacaOptions : default_auth_1.defaultAlpacaAuth();
        this.tda = new tda.Api(tdaOptions.auth, (_a = tdaOptions.autorefresh) !== null && _a !== void 0 ? _a : true);
        this.alpaca = new alpaca.Api(alpacaOptions);
    }
    init() {
        var _a, _b;
        return Promise.all([(_a = this.alpaca) === null || _a === void 0 ? void 0 : _a.init(), (_b = this.tda) === null || _b === void 0 ? void 0 : _b.init()]);
    }
    end() {
        var _a, _b;
        return Promise.all([(_a = this.alpaca) === null || _a === void 0 ? void 0 : _a.end(), (_b = this.tda) === null || _b === void 0 ? void 0 : _b.end()]);
    }
    getAccount(broker) {
        return Promise.all(this.resolveMaybeBrokerChoice(broker).map((api) => api.getAccount()));
    }
    getBars(options) {
        return this.tda.getBars(options);
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
    /** Return market dates starting with the next business day and going back 300 business days.
     * This equates to roughly
     */
    marketCalendar() {
        return this.alpaca.marketCalendar();
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
    getOrders(broker, options) {
        let api = this.resolveBrokerChoice(broker);
        return api.getOrders(options);
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