import { GetOrders } from './broker_interface';
import { OrderDuration, OrderType } from 'types';
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
    progress?: (data: any) => any;
}
export declare function waitForOrders(api: GetOrders, options: WaitForOrdersOptions): Promise<Map<any, any>>;
