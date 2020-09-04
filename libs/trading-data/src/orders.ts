import sorter from 'sorters';
import { alpaca } from './services';

export interface GetPendingOrdersOptions {
  orderIds: string[] | Set<string>;
  after?: Date;
  progress?: (data) => any;
}

// This assumes one order
export async function waitForOrders(options: GetPendingOrdersOptions) {
  let ids = new Set(options.orderIds);
  let doneOrders = new Map();

  async function getPendingOrders() {
    // Now look at the filled orders.
    let orders = await alpaca.getOrders({
      status: 'all',
      after: options.after,
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
        ['filled', 'canceled', 'expired', 'replaced'].includes(order.status)
      ) {
        console.log(
          `Finished order for ${order.symbol}: ${order.filled_qty} shares at ${order.filled_avg_price} each (status ${order.status})`
        );
        doneOrders.set(order.id, order);
      }
    }

    let statuses = Object.entries(ordersByStatus)
      .sort(sorter((x) => x[0]))
      .map(([key, val]) => `${key}: ${val}`)
      .join(', ');

    if (options.progress) {
      options.progress({
        orders: doneOrders,
        statusCounts: statuses,
      });
    }
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
