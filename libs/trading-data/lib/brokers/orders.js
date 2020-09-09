"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitForOrders = void 0;
const sorters_1 = require("sorters");
const types_1 = require("types");
// This assumes one order
async function waitForOrders(api, options) {
    let ids = new Set(options.orderIds);
    let doneOrders = new Map();
    async function getPendingOrders() {
        var _a, _b;
        // Now look at the filled orders.
        let orders = await api.getOrders({
            startDate: options.after,
        });
        let ordersByStatus = {};
        let currentOrders = new Map();
        for (let order of orders) {
            if (!ids.has(order.id)) {
                continue;
            }
            ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1;
            currentOrders.set(order.id, order);
            if (doneOrders.has(order.id)) {
                continue;
            }
            if ([
                types_1.OrderStatus.canceled,
                types_1.OrderStatus.filled,
                types_1.OrderStatus.rejected,
            ].includes(order.status)) {
                (_a = options.progress) === null || _a === void 0 ? void 0 : _a.call(options, {
                    message: `Finished order for ${order.legs[0].symbol}: ${order.legs[0].filled} shares at ${order.legs[0].price} each (status ${order.status})`,
                });
                doneOrders.set(order.id, order);
            }
        }
        let statuses = Object.entries(ordersByStatus)
            .sort(sorters_1.default((x) => x[0]))
            .map(([key, val]) => `${key}: ${val}`)
            .join(', ');
        (_b = options.progress) === null || _b === void 0 ? void 0 : _b.call(options, {
            orders: doneOrders,
            message: statuses,
        });
    }
    let index = 0;
    while (doneOrders.size < ids.size) {
        if (index < 5) {
            index++;
        }
        let delay = Math.min(500 * Math.pow(2, index), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));
        await getPendingOrders();
    }
    return doneOrders;
}
exports.waitForOrders = waitForOrders;
//# sourceMappingURL=orders.js.map