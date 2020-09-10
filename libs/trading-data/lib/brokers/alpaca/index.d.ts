import * as Alpaca from '@alpacahq/alpaca-trade-api';
import { Broker, GetBarsOptions, GetOrderOptions } from '../broker_interface';
import { Account, Bar, Order, Position, MarketCalendar } from 'types';
import { CreateOrderOptions } from '../orders';
export interface AlpacaBrokerOptions {
    key: string;
    secret: string;
    paper?: boolean;
}
export declare class Api implements Broker {
    api: Alpaca;
    constructor(options: AlpacaBrokerOptions);
    init(): void;
    end(): void;
    refreshAuth(): Promise<void>;
    getAccount(): Promise<Account>;
    getBars(options: GetBarsOptions): Promise<Map<string, Bar[]>>;
    marketStatus(): Promise<{
        open: any;
        nextOpen: Date;
        nextClose: Date;
    }>;
    marketCalendar(): Promise<MarketCalendar>;
    getOrders(options?: GetOrderOptions): Promise<Order[]>;
    getPositions(): Promise<Position[]>;
    createOrder(order: CreateOrderOptions): Promise<Order>;
}
