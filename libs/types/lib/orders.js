"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderDuration = exports.OrderType = exports.OrderStatus = exports.BrokerChoice = void 0;
var BrokerChoice;
(function (BrokerChoice) {
    BrokerChoice["tda"] = "tda";
    BrokerChoice["alpaca"] = "alpaca";
})(BrokerChoice = exports.BrokerChoice || (exports.BrokerChoice = {}));
var OrderStatus;
(function (OrderStatus) {
    OrderStatus["pending"] = "pending";
    OrderStatus["active"] = "active";
    OrderStatus["canceled"] = "canceled";
    OrderStatus["filled"] = "filled";
    OrderStatus["rejected"] = "rejected";
})(OrderStatus = exports.OrderStatus || (exports.OrderStatus = {}));
var OrderType;
(function (OrderType) {
    OrderType["market"] = "market";
    OrderType["limit"] = "limit";
    OrderType["stop"] = "stop";
    OrderType["stopLimit"] = "stop-limit";
})(OrderType = exports.OrderType || (exports.OrderType = {}));
var OrderDuration;
(function (OrderDuration) {
    OrderDuration["day"] = "day";
    OrderDuration["gtc"] = "gtc";
})(OrderDuration = exports.OrderDuration || (exports.OrderDuration = {}));
//# sourceMappingURL=orders.js.map