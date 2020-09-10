import { Account, BarTimeframe, Order } from 'types';
/** Functions that need to be implemented by all brokers */
export interface Broker {
    refreshAuth(): Promise<any>;
    init(): void | Promise<any>;
    end(): void | Promise<any>;
    getAccount(): Promise<Account>;
}
export interface GetBarsOptions {
    symbols: string[];
    timeframe: BarTimeframe;
    /** Number of days to retrieve, if start is omitted.
     * Defaults to 2 years worth for day timeframe and 1 day for minute timeframes */
    numBars?: number;
    /** Get bars on or after this date */
    start?: Date;
    /** Get bars on or before this date. Defaults to end of day yesterday */
    end?: Date;
    /** By default this returns data adjusted for dividends and splits. Set to true to get unadjusted data */
    unadjusted?: boolean;
}
export interface GetOrderOptions {
    startDate?: Date;
    endDate?: Date;
    filled?: boolean;
}
export interface GetOrders {
    getOrders(options: GetOrderOptions): Promise<Order[]>;
}
