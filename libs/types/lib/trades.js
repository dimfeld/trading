"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeDuration = exports.TradeType = exports.TradeStatus = exports.BrokerChoice = void 0;
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
var TradeType;
(function (TradeType) {
    TradeType["market"] = "market";
    TradeType["limit"] = "limit";
    TradeType["stop"] = "stop";
    TradeType["stopLimit"] = "stop-limit";
})(TradeType = exports.TradeType || (exports.TradeType = {}));
var TradeDuration;
(function (TradeDuration) {
    TradeDuration["day"] = "day";
    TradeDuration["gtc"] = "gtc";
})(TradeDuration = exports.TradeDuration || (exports.TradeDuration = {}));
//# sourceMappingURL=trades.js.map