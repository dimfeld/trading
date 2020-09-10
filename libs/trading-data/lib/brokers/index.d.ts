import * as tda from './tda';
import * as alpaca from './alpaca';
import { GetBarsOptions } from './broker_interface';
import { Account, Bar, MarketStatus, MarketCalendar, Position, BrokerChoice } from 'types';
import { WaitForOrdersOptions, CreateOrderOptions } from './orders';
import { GetOrderOptions } from '..';
export { GetBarsOptions, GetOrderOptions } from './broker_interface';
export { GetOptionChainOptions, AuthData as TdaAuthData } from './tda';
export * from './default_auth';
export interface BrokerOptions {
    tda?: {
        auth: tda.AuthData;
        /** Defaults to true */
        autorefresh?: boolean;
    };
    alpaca?: alpaca.AlpacaBrokerOptions;
}
/** A class that arbitrates requests through multiple brokers */
export declare class Brokers {
    tda?: tda.Api;
    alpaca?: alpaca.Api;
    constructor({ tda: tdaOptions, alpaca: alpacaOptions }?: BrokerOptions);
    init(): Promise<[void, void]>;
    end(): Promise<[void, void]>;
    getAccount(broker?: BrokerChoice): Promise<Account[]>;
    getBars(options: GetBarsOptions): Promise<Map<string, Bar[]>>;
    getPositions(broker?: BrokerChoice): Promise<Position[]>;
    getQuotes(symbols: string[]): Promise<{
        [symbol: string]: import("types").Quote;
    }>;
    getOptionChain(options: tda.GetOptionChainOptions): Promise<import("types").OptionChain>;
    marketStatus(): Promise<MarketStatus>;
    /** Return market dates starting with the next business day and going back 300 business days.
     * This equates to roughly
     */
    marketCalendar(): Promise<MarketCalendar>;
    private resolveBrokerChoice;
    private resolveMaybeBrokerChoice;
    createOrder(broker: BrokerChoice, options: CreateOrderOptions): Promise<import("types").Order>;
    getOrders(broker: BrokerChoice, options?: GetOrderOptions): Promise<import("types").Order[]>;
    waitForOrders(broker: BrokerChoice, options: WaitForOrdersOptions): Promise<Map<string, import("types").Order>>;
}
export declare function createBrokers(options?: BrokerOptions): Promise<Brokers>;
