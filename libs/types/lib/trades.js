"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeStatus = exports.BrokerChoice = void 0;
var BrokerChoice;
(function (BrokerChoice) {
    BrokerChoice["tda"] = "tda";
    BrokerChoice["alpaca"] = "alpaca";
})(BrokerChoice = exports.BrokerChoice || (exports.BrokerChoice = {}));
var TradeStatus;
(function (TradeStatus) {
    TradeStatus["pending"] = "pending";
    TradeStatus["active"] = "active";
    TradeStatus["canceled"] = "canceled";
    TradeStatus["filled"] = "filled";
    TradeStatus["rejected"] = "rejected";
})(TradeStatus = exports.TradeStatus || (exports.TradeStatus = {}));
//# sourceMappingURL=trades.js.map