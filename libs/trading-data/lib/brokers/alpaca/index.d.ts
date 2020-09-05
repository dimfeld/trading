import * as Alpaca from '@alpacahq/alpaca-trade-api';
import { Broker, GetBarsOptions, GetTradeOptions } from '../broker_interface';
import { Account, Bar, Trade, Position } from 'types';
export interface AlpacaBrokerOptions {
    key: string;
    secret: string;
    paper?: boolean;
}
export declare class Api implements Broker {
    api: Alpaca;
    constructor(options: AlpacaBrokerOptions);
    init(): void;
    refreshAuth(): Promise<void>;
    getAccount(): Promise<Account>;
    getBars(options: GetBarsOptions): Promise<Map<string, Bar[]>>;
    marketStatus(): Promise<{
        open: any;
        nextOpen: Date;
        nextClose: Date;
    }>;
    getTrades(options?: GetTradeOptions): Promise<Trade[]>;
    getPositions(): Promise<Position[]>;
}
