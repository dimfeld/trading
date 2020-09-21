import * as Alpaca from '@alpacahq/alpaca-trade-api';
import sorter from 'sorters';
import * as debugMod from 'debug';
import * as date from 'date-fns';
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
  MarketCalendar,
  MarketCalendarDate,
  BarTimeframe,
} from 'types';
import { CreateOrderOptions } from '../orders';

const debug = debugMod('alpaca');

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
          console.dir(e, { depth: null });
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
    broker: BrokerChoice.alpaca,
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
    debug('getAccount');
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
    debug('getBars', options);
    /* This polygon integration doesn't work correctly... it seems to omit every Friday */
    let multiplier = 1;
    let timeframe;
    switch (options.timeframe) {
      case BarTimeframe.day:
        timeframe = 'day';
        break;
      case BarTimeframe.fiveminute:
        timeframe = 'minute';
        multiplier = 5;
        break;
      case BarTimeframe.fifteenminute:
        timeframe = 'minute';
        multiplier = 15;
        break;
      case BarTimeframe.thirtyminute:
        timeframe = 'minute';
        multiplier = 30;
        break;
    }

    let endDate = options.end || new Date();

    let start = options.start.valueOf();
    let end = endDate.valueOf();
    console.dir({ start, end });
    let data = await Promise.all(
      options.symbols.map(async (s) => {
        let result = await request(() =>
          this.api.getHistoricAggregatesV2(
            s,
            multiplier,
            timeframe,
            start,
            end,
            { unadjusted: options.unadjusted, sort: 'desc' }
          )
        );

        console.dir(result.results);

        let bars = result.results.map((r) => {
          return {
            time: new Date(r.t),
            open: r.o,
            close: r.c,
            high: r.h,
            low: r.l,
            volume: r.v,
          };
        });

        return {
          symbol: s,
          bars,
        };
      })
    );

    let output = new Map<string, Bar[]>();
    for (let bars of data) {
      output.set(bars.symbol, bars.bars);
    }

    return output;
  }

  async marketStatus() {
    debug('marketStatus');
    let data: any = await request(() => this.api.getClock());
    return {
      open: data.open,
      nextOpen: new Date(data.next_open),
      nextClose: new Date(data.next_close),
    };
  }

  async marketCalendar(): Promise<MarketCalendarDate[]> {
    debug('marketCalendar');
    let data = await request(() =>
      this.api.getCalendar({
        start: date.subBusinessDays(new Date(), 300),
        end: date.addBusinessDays(new Date(), 90),
      })
    );

    return data.map((c) => {
      return {
        date: new Date(c.date),
        open: c.open,
        close: c.close,
      } as MarketCalendarDate;
    });
  }

  async getOrders(options: GetOrderOptions = {}): Promise<Order[]> {
    debug('getOrders', options);
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
    debug('getPositions');
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
    debug('createOrder', order);
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
