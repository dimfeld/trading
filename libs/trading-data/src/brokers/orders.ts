import sorter from 'sorters';
import { GetOrders } from './broker_interface';
import { OrderDuration, OrderStatus, OrderType } from 'types';

export interface CreateOrderLeg {
  symbol: string;
  size: number;
}

export interface CreateOrderOptions {
  type: OrderType;

  /** Price, for limit orders */
  price?: number;

  /** Stop price, for stop orders. A stop limit order will use this and `price` */
  stopPrice?: number;

  legs: CreateOrderLeg[];

  /** To create a linked profit-taking order */
  linkedTakeProfit?: {
    limitPrice: number;
  };

  /** To create a linked stop loss order. */
  linkedStopLoss?: {
    stopPrice: number;
    /** If omitted, the stop loss will execute as a limit order. */
    limitPrice?: number;
  };

  /** Defaults to false */
  extendedHours?: boolean;
  /** day or GTC. Defaults to day */
  duration?: OrderDuration;
}

export interface WaitForOrdersOptions {
  orderIds: string[] | Set<string>;
  after?: Date;
  progress?: (data) => any;
}

// This assumes one order
export async function waitForOrders(
  api: GetOrders,
  options: WaitForOrdersOptions
) {
  let ids = new Set(options.orderIds);
  let doneOrders = new Map();

  async function getPendingOrders() {
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

      if (
        [
          OrderStatus.canceled,
          OrderStatus.filled,
          OrderStatus.rejected,
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
