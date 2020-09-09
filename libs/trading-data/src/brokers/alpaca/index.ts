import * as Alpaca from '@alpacahq/alpaca-trade-api';
import { Broker, GetBarsOptions, GetOrderOptions } from '../broker_interface';
import {
  Account,
  BrokerChoice,
  Bar,
  Order,
  OrderStatus,
  Position,
  OrderDuration,
  OrderType,
} from 'types';
import { CreateOrderOptions } from '../orders';

export interface AlpacaBrokerOptions {
  key: string;
  secret: string;
  paper?: boolean;
}

const tradeTypeMap = {
  [OrderType.limit]: 'limit',
  [OrderType.market]: 'market',
  [OrderType.stop]: 'stop',
  [OrderType.stopLimit]: 'stop_limit',
};

const tradeDurationMap = {
  [OrderDuration.day]: 'day',
  [OrderDuration.gtc]: 'gtc',
};

const statusMap = {
  new: OrderStatus.pending,
  accepted: OrderStatus.pending,
  pending_new: OrderStatus.pending,
  accepted_for_bidding: OrderStatus.pending,
  stopped: OrderStatus.active,
  rejected: OrderStatus.rejected,
  suspended: OrderStatus.pending,
  calculated: OrderStatus.active,
  partially_filled: OrderStatus.active,
  filled: OrderStatus.filled,
  done_for_day: OrderStatus.active,
  canceled: OrderStatus.canceled,
  expired: OrderStatus.canceled,
  replaced: OrderStatus.canceled,
  pending_cancel: OrderStatus.active,
  pending_replace: OrderStatus.active,
};

function request<T = any>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    let tryIt = () => {
      fn()
        .then(resolve)
        .catch((e) => {
          if (e.response?.statusCode === 429) {
            // Try again
            setTimeout(tryIt, 1000);
          } else {
            reject(e);
          }
        });
    };

    tryIt();
  });
}

function convertAlpacaOrder(trade) {
  let price = Number(
    trade.filled_avg_price || trade.limit_price || trade.stop_price
  );

  return {
    id: trade.id,
    status: statusMap[trade.status],
    traded: new Date(
      trade.filled_at ||
        trade.canceled_at ||
        trade.filled_at ||
        trade.replaced_at ||
        trade.submitted_at ||
        trade.created_at
    ),
    commissions: 0,
    price,
    legs: [
      {
        symbol: trade.symbol,
        price,
        size: +trade.qty,
        filled: +trade.filled_qty,
      },
    ],
  };
}

export class Api implements Broker {
  api: Alpaca;

  constructor(options: AlpacaBrokerOptions) {
    this.api = new Alpaca({
      keyId: options.key,
      secretKey: options.secret,
      paper: options.paper ?? false,
      usePolygon: true,
    });
  }

  // Nothing to do here.
  init() {}
  end() {}
  async refreshAuth() {}

  async getAccount(): Promise<Account> {
    let data: any = await request(() => this.api.getAccount());
    return {
      id: data.id,
      buyingPower: +data.buying_power,
      cash: +data.cash,
      dayTradeCount: +data.daytrade_count,
      dayTradesRestricted: data.pattern_day_trader,
      isDayTrader: +data.equity < 25000,
      portfolioValue: +data.equity,
      maintenanceMargin: +data.maintenance_margin,
    };
  }

  async getBars(options: GetBarsOptions) {
    let data: any = await request(() =>
      this.api.getBars(options.timeframe, options.symbols.join(','), {
        start: options.start,
        end: options.end,
        limit: options.limit,
      })
    );

    let output = new Map<string, Bar[]>();
    for (let key in data) {
      output.set(
        key,
        data[key].map((aBar) => {
          return {
            open: +aBar.openPrice,
            close: +aBar.closePrice,
            high: +aBar.highPrice,
            low: +aBar.lowPrice,
            volume: +aBar.volume,
            time: new Date(aBar.startEpochTime),
          };
        })
      );
    }

    return output;
  }

  async marketStatus() {
    let data: any = await request(() => this.api.getClock());
    return {
      open: data.open,
      nextOpen: new Date(data.next_open),
      nextClose: new Date(data.next_close),
    };
  }

  async getOrders(options: GetOrderOptions = {}): Promise<Order[]> {
    let reqOptions = {
      status: options.filled ? 'closed' : 'all',
      after: options.startDate,
      until: options.endDate,
    };

    let data: any[] = await request(() => this.api.getOrders(reqOptions));

    return data
      .map((trade) => {
        if (options.filled && trade.status !== 'filled') {
          return null;
        }

        return convertAlpacaOrder(trade);
      })
      .filter(Boolean);
  }

  async getPositions(): Promise<Position[]> {
    let pos = await this.api.getPositions();
    return pos.map((p) => {
      return {
        symbol: p.symbol,
        price: +p.avg_entry_price,
        broker: BrokerChoice.alpaca,
        size: p.side === 'long' ? +p.qty : -p.qty,
      };
    });
  }

  async createOrder(order: CreateOrderOptions): Promise<Order> {
    if (order.legs.length !== 1) {
      // May be able to relax this at some point?
      throw new Error('Alpaca orders must have only one leg');
    }

    let orderClass: string;
    if (order.linkedStopLoss && order.linkedTakeProfit) {
      orderClass = 'bracket';
    } else if (order.linkedStopLoss || order.linkedTakeProfit) {
      orderClass = 'oto';
    }

    let orderType = tradeTypeMap[order.type];
    if (!orderType) {
      throw new Error(`Unsupported order type ${order.type}`);
    }

    let tif = tradeDurationMap[order.duration || OrderDuration.day];
    if (!tif) {
      throw new Error(`Unsupported order duration ${order.duration}`);
    }

    let linkedTakeProfit;
    if (order.linkedTakeProfit) {
      linkedTakeProfit = {
        limit_price: order.linkedTakeProfit.limitPrice?.toFixed(2),
      };
    }

    let linkedStopLoss;
    if (order.linkedStopLoss) {
      linkedStopLoss = {
        stop_price: order.linkedStopLoss.stopPrice?.toFixed(2),
        limit_price: order.linkedStopLoss.limitPrice?.toFixed(2),
      };
    }

    let size = order.legs[0].size;
    let result = await this.api.createOrder({
      symbol: order.legs[0].symbol,
      side: size > 0 ? 'buy' : 'sell',
      qty: Math.abs(size).toString(),
      time_in_force: tif,
      type: orderType,
      extended_hours: order.extendedHours ?? false,
      limit_price:
        order.type === OrderType.limit || order.type === OrderType.stopLimit
          ? order.price?.toFixed(2)
          : undefined,
      stop_price:
        order.type === OrderType.stop || order.type === OrderType.stopLimit
          ? order.stopPrice?.toFixed(2)
          : undefined,
      take_profit: linkedTakeProfit,
      stopLoss: linkedStopLoss,
    });

    return convertAlpacaOrder(result);
  }
}
