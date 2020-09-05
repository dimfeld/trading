import sorter from 'sorters';
import { GetTrades } from './broker_interface';
import { TradeStatus } from 'types';

export interface WaitForOrdersOptions {
  orderIds: string[] | Set<string>;
  after?: Date;
  progress?: (data) => any;
}

// This assumes one order
export async function waitForOrders(
  api: GetTrades,
  options: WaitForOrdersOptions
) {
  let ids = new Set(options.orderIds);
  let doneOrders = new Map();

  async function getPendingOrders() {
    // Now look at the filled orders.
    let orders = await api.getTrades({
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

      if (
        [
          TradeStatus.canceled,
          TradeStatus.filled,
          TradeStatus.rejected,
        ].includes(order.status)
      ) {
        options.progress?.(
          `Finished order for ${order.legs[0].symbol}: ${order.legs[0].filled} shares at ${order.legs[0].price} each (status ${order.status})`
        );
        doneOrders.set(order.id, order);
      }
    }

    let statuses = Object.entries(ordersByStatus)
      .sort(sorter((x) => x[0]))
      .map(([key, val]) => `${key}: ${val}`)
      .join(', ');

    options.progress?.({
      orders: doneOrders,
      statusCounts: statuses,
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
