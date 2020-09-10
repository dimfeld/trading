import * as _ from 'lodash';
import got = require('got');
import * as querystring from 'querystring';
import * as debugMod from 'debug';

import { Broker, GetBarsOptions, GetOrderOptions } from '../broker_interface';
import { Account, Bar, BarTimeframe, BrokerChoice, Position } from 'types';

import {
  Order,
  OrderStatus,
  Quote,
  OptionChain,
  ExpirationDateMap,
} from 'types';
import { CreateOrderOptions } from '../orders';

const debug = debugMod('tda_api');

const HOST = 'https://api.tdameritrade.com';

const indexes = ['SPX', 'RUT', 'NDX'];

const statusMap = {
  AWAITING_PARENT_ORDER: OrderStatus.pending,
  AWAITING_CONDITION: OrderStatus.pending,
  AWAITING_MANUAL_REVIEW: OrderStatus.pending,
  ACCEPTED: OrderStatus.pending,
  AWAITING_UR_OUT: OrderStatus.active,
  PENDING_ACTIVATION: OrderStatus.pending,
  QUEUED: OrderStatus.pending,
  WORKING: OrderStatus.active,
  REJECTED: OrderStatus.rejected,
  PENDING_CANCEL: OrderStatus.active,
  CANCELED: OrderStatus.canceled,
  PENDING_REPLACE: OrderStatus.active,
  REPLACED: OrderStatus.canceled,
  FILLED: OrderStatus.filled,
  EXPIRED: OrderStatus.canceled,
};

const symbolToTda: _.Dictionary<string> = {};
const tdaToSymbol: _.Dictionary<string> = {};
for (let sym of indexes) {
  let tda = `$${sym}.X`;
  symbolToTda[sym] = tda;
  tdaToSymbol[tda] = sym;
}

export function optionInfoFromSymbol(symbol: string) {
  let underlying = symbol.slice(0, 6).trim();
  if (symbol.length <= 6) {
    return {
      underlying,
      expiration: undefined,
      call: undefined,
      strike: undefined,
    };
  }

  return {
    underlying,
    expiration: symbol.slice(6, 12),
    call: symbol[12] === 'C',
    strike: +_.trimStart(symbol.slice(13)) / 1000,
  };
}

export function occToTdaSymbol(occ: string) {
  if (occ.length !== 21 || occ.indexOf('_') >= 0) {
    // Not an OCC-format option symbol. Just do the simple transformation.
    return symbolToTda[occ] || occ;
  }

  // Change from OCC format to the format that TDA expects.
  let info = optionInfoFromSymbol(occ);

  let side = info.call ? 'C' : 'P';

  // OCC expiration is YYMMDD. TDA is MMDDYY
  let expiration = `${info.expiration.slice(2, 4)}${info.expiration.slice(
    4,
    6
  )}${info.expiration.slice(0, 2)}`;

  let dollars = _.trimStart(occ.slice(13, 18), ' 0');
  let cents_raw = _.trimEnd(occ.slice(18), ' 0');
  let cents = cents_raw ? `.${cents_raw}` : '';

  return `${info.underlying}_${expiration}${side}${dollars}${cents}`;
}

export function tdaToOccSymbol(tda: string) {
  let occ = tdaToSymbol[tda];
  if (occ) {
    return occ;
  }

  let m = /^([a-zA-Z]+)(?:_(\d\d)(\d\d)(\d\d)([C|P])(\d*)(?:\.(\d+))?)?$/.exec(
    tda
  );
  if (!m) {
    throw new Error(`Failed to parse TDA symbol '${tda}'`);
  }

  let underlying = m[1];

  if (!m[2]) {
    // It's an equity symbol so just return it as-is;
    return underlying;
  }

  underlying = _.padEnd(m[1], 6, ' ');
  let month = m[2];
  let day = m[3];
  let year = m[4];
  let side = m[5];
  let dollars = _.padStart(m[6], 5, '0');
  let cents = _.padEnd(m[7] || '000', 3, '0');

  return `${underlying}${year}${month}${day}${side}${dollars}${cents}`;
}

export interface GetOptionChainOptions {
  symbol: string;
  from_date?: Date;
  to_date?: Date;
  include_nonstandard?: boolean;
  contract_type?: 'CALL' | 'PUT';
  near_the_money?: boolean;
}

export interface GetTransactionsOptions {
  symbol?: string;
  startDate?: string;
  endDate?: string;
}

export interface AuthData {
  client_id: string;
  refresh_token: string;
}

export class Api implements Broker {
  auth: AuthData;
  access_token: string;
  accountId: string;
  autorefresh: boolean;

  refreshTimer: any;

  constructor(auth: AuthData, autorefresh = true) {
    this.auth = auth;
    this.autorefresh = autorefresh;
  }

  async refreshAuth() {
    // Refresh the access token.
    try {
      let body = await got(`${HOST}/v1/oauth2/token`, {
        method: 'POST',
        form: true,
        body: {
          grant_type: 'refresh_token',
          refresh_token: this.auth.refresh_token,
          client_id: this.auth.client_id,
        },
      });

      let result = JSON.parse(body.body);
      this.access_token = result.access_token;

      if (this.autorefresh) {
        this.refreshTimer = setTimeout(
          () => this.refreshAuth(),
          (result.expires_in / 2) * 1000
        );
      }
    } catch (e) {
      console.error(e);
      if (this.autorefresh) {
        this.refreshTimer = setTimeout(() => this.refreshAuth(), 60000);
      } else {
        throw e;
      }
    }
  }

  async init() {
    await this.refreshAuth();

    let accountData = await this.getAccount();
    this.accountId = accountData.id;
  }

  end() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
  }

  private request(url: string, qs?) {
    let qsStr = qs ? '?' + querystring.stringify(qs) : '';
    return got(url + qsStr, {
      method: 'GET',
      json: true,
      headers: {
        authorization: 'Bearer ' + this.access_token,
      },
    }).then((res) => res.body);
  }

  async getOptionChain(options: GetOptionChainOptions): Promise<OptionChain> {
    let url = `${HOST}/v1/marketdata/chains`;

    let qs: any = {
      symbol: options.symbol,
      strikeCount: options.near_the_money ? 30 : undefined,
      range: 'ALL',
      includeQuotes: 'TRUE',
      optionType: 'ALL',
      expMonth: 'ALL',
    };

    if (options.contract_type) {
      qs.contractType = options.contract_type;
    }

    if (options.to_date) {
      qs.toDate = options.to_date.toISOString();
    }

    if (options.from_date) {
      qs.fromDate = options.from_date.toISOString();
    }

    let result: OptionChain = await this.request(url, qs);

    function convertExpDateMapSymbols(
      expDateMap: ExpirationDateMap | undefined
    ) {
      if (!expDateMap) {
        return;
      }
      _.each(expDateMap || {}, (strikes) => {
        _.each(strikes, (strike) => {
          _.each(strike, (contract) => {
            contract.symbol = tdaToOccSymbol(contract.symbol);
          });
        });
      });
    }

    convertExpDateMapSymbols(result.callExpDateMap);
    convertExpDateMapSymbols(result.putExpDateMap);

    return result;
  }

  async getQuotes(
    symbols: string | string[]
  ): Promise<{ [symbol: string]: Quote }> {
    let url = `${HOST}/v1/marketdata/quotes`;

    let symbol_list = _.isArray(symbols) ? symbols : [symbols];
    let formatted_symbols = _.transform(
      symbol_list,
      (acc: { [s: string]: string }, s) => {
        let tda_symbol = occToTdaSymbol(s);
        acc[tda_symbol] = s;
      },
      {}
    );

    let qs = {
      symbol: _.keys(formatted_symbols).join(','),
    };

    let results = await this.request(url, qs);
    return _.transform(
      results,
      (acc, result: Quote, tda_symbol) => {
        let occ_symbol = formatted_symbols[tda_symbol];
        acc[occ_symbol] = result;
      },
      {}
    );
  }

  async getBars(options: GetBarsOptions) {
    let periodType: string;
    let candleSize = 1;
    let timeframe;
    switch (options.timeframe) {
      case BarTimeframe.minute:
        timeframe = 'minute';
        periodType = 'day';
        break;
      case BarTimeframe.fiveminute:
        timeframe = 'minute';
        periodType = 'day';
        candleSize = 5;
        break;
      case BarTimeframe.fifteenminute:
        timeframe = 'minute';
        periodType = 'day';
        candleSize = 15;
        break;
      case BarTimeframe.thirtyminute:
        timeframe = 'minute';
        periodType = 'day';
        candleSize = 30;
        break;
      case BarTimeframe.day:
        timeframe = 'daily';
        periodType = 'year';
        break;
    }

    let qs: any = {
      periodType,
      frequency: candleSize,
      frequencyType: timeframe,
      needExtendedHoursData: 'false',
    };

    if (options.start) {
      qs.startDate = options.start.valueOf();
      qs.endDate = (options.end || new Date()).valueOf();
    } else {
      let period = options.numBars;
      if (!period) {
        period = periodType === 'year' ? 2 : 1;
      }
      qs.period = period;
    }

    let results = await Promise.all(
      options.symbols.map(async (s) => {
        let url = `${HOST}/v1/marketdata/${s}/pricehistory`;
        let results = await this.request(url, qs);
        let bars = results.candles.map((c) => {
          return {
            open: c.open,
            close: c.close,
            low: c.low,
            high: c.high,
            volume: c.volume,
            time: c.datetime,
          };
        });

        return {
          symbol: s,
          bars,
        };
      })
    );

    let output = new Map<string, Bar[]>();
    for (let result of results) {
      output.set(result.symbol, result.bars);
    }
    return output;
  }

  async getAccounts(extraFields?: string[]) {
    let q = extraFields ? '?fields=' + extraFields.join(',') : '';
    return this.request(`${HOST}/v1/accounts${q}`);
  }

  async getAccount(): Promise<Account> {
    let accounts = await this.getAccounts();
    let data: any = Object.values(accounts[0])[0];
    return {
      id: data.accountId,
      buyingPower: data.currentBalances.buyingPower,
      cash: data.currentBalances.cashBalance,
      dayTradeCount: data.roundTrips,
      dayTradesRestricted: data.currentBalances.daytradingBuyingPower <= 0,
      isDayTrader: data.isDayTrader,
      portfolioValue: data.equity,
      maintenanceMargin: data.currentBalances.maintenanceRequirement,
    };
  }

  async getPositions(): Promise<Position[]> {
    let accounts = await this.getAccounts(['positions']);
    let account: any = Object.values(accounts[0])[0];
    return account.positions.map((pos) => {
      return {
        broker: BrokerChoice.tda,
        symbol: tdaToOccSymbol(pos.instrument.symbol),
        size: pos.longQuantity || -pos.shortQuantity,
        price: pos.averagePrice,
      };
    });
  }

  async getTransactionHistory(options: GetTransactionsOptions = {}) {
    let url = `${HOST}/v1/accounts/${this.accountId}/transactions`;
    let qs = {
      type: 'ALL',
      ..._.pick(options, ['symbol', 'startDate', 'endDate']),
    };

    return this.request(url, qs);
  }

  async getOrders(options: GetOrderOptions = {}): Promise<Order[]> {
    let url = `${HOST}/v1/accounts/${this.accountId}/orders`;
    let qs = {
      fromEnteredTime: options.startDate,
      toEnteredTime: options.endDate,
    };

    let results = await this.request(url, qs);

    let trades = _.flatMap(results, (result) => {
      debug(result);
      let orders = [];
      let children = result.childOrderStrategies;
      if (children && children.length) {
        if (options.filled) {
          orders.push(
            ..._.filter(
              children,
              (child) => child.status === 'FILLED' || child.filledQuantity > 0
            )
          );
        } else {
          orders.push(...children);
        }
      }

      if (
        !options.filled ||
        result.status === 'FILLED' ||
        result.filledQuantity > 0
      ) {
        orders.push(result);
      }

      return orders;
    });

    return _.map(trades, (trade) => {
      let latestExecution = new Date(0).toISOString();
      let executionPrices = _.chain(trade.orderActivityCollection)
        .flatMap((ex) => ex.executionLegs)
        .transform((acc, executionLeg) => {
          let legId = executionLeg.legId;
          let info = acc[legId] || { total: 0, size: 0 };
          info.total += executionLeg.quantity * executionLeg.price;
          info.size += executionLeg.quantity;
          acc[legId] = info;

          if (executionLeg.time > latestExecution) {
            latestExecution = executionLeg.time;
          }
        }, [])
        .value();

      let legs = _.map(trade.orderLegCollection, (leg) => {
        let symbol = tdaToOccSymbol(leg.instrument.symbol);
        let multiplier = leg.instruction.startsWith('BUY') ? 1 : -1;
        let legPrices = executionPrices[leg.legId];

        let priceEach = legPrices.total / legPrices.size;

        return {
          symbol,
          price: priceEach,
          filled: legPrices.size * multiplier,
          size: leg.quantity * multiplier,
        };
      });

      return {
        id: trade.orderId,
        status: statusMap[trade.status],
        traded: trade.closeTime || latestExecution,
        price: trade.price,
        commissions: null,
        legs,
      };
    });
  }

  async createOrder(order: CreateOrderOptions): Promise<Order> {
    throw new Error('not yet supported');
    return {
      id: null,
      commissions: 0,
      legs: [],
      price: null,
      status: OrderStatus.rejected,
      traded: new Date(),
    };
    // See https://developer.tdameritrade.com/content/place-order-samples
    // and https://developer.tdameritrade.com/account-access/apis/post/accounts/%7BaccountId%7D/orders-0
  }
}
