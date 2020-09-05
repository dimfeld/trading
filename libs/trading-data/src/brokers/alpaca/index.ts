import * as Alpaca from '@alpacahq/alpaca-trade-api';
import { Broker, GetBarsOptions, GetTradeOptions } from '../broker_interface';
import {
  Account,
  BrokerChoice,
  Bar,
  Trade,
  TradeStatus,
  Position,
} from 'types';

export interface AlpacaBrokerOptions {
  key: string;
  secret: string;
  paper?: boolean;
}

const statusMap = {
  new: TradeStatus.pending,
  accepted: TradeStatus.pending,
  pending_new: TradeStatus.pending,
  accepted_for_bidding: TradeStatus.pending,
  stopped: TradeStatus.active,
  rejected: TradeStatus.rejected,
  suspended: TradeStatus.pending,
  calculated: TradeStatus.active,
  partially_filled: TradeStatus.active,
  filled: TradeStatus.filled,
  done_for_day: TradeStatus.active,
  canceled: TradeStatus.canceled,
  expired: TradeStatus.canceled,
  replaced: TradeStatus.canceled,
  pending_cancel: TradeStatus.active,
  pending_replace: TradeStatus.active,
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
    for (let key of data) {
      output.set(
        key,
        data[key].map((aBar) => {
          return {
            open: +aBar.openPrice,
            close: +aBar.closePrice,
            high: +aBar.highPrice,
            low: +aBar.lowPrice,
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

  async getTrades(options: GetTradeOptions = {}): Promise<Trade[]> {
    let reqOptions = {
      status: options.filled ? 'closed' : 'all',
      after: options.startDate,
      until: options.endDate,
    };

    let data: any[] = await request(() => this.api.getOrders(reqOptions));

    return data
      .map((trade) => {
        let price = Number(
          trade.filled_avg_price || trade.limit_price || trade.stop_price
        );

        if (options.filled && trade.status !== 'filled') {
          return null;
        }

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
        size: p.size === 'long' ? +p.qty : -p.qty,
      };
    });
  }
}
