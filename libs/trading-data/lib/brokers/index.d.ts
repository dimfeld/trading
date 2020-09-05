import * as tda from './tda';
import * as alpaca from './alpaca';
import { GetBarsOptions } from './broker_interface';
import { Account, Bar, MarketStatus, Position, BrokerChoice } from 'types';
import { WaitForOrdersOptions } from './orders';
export { GetBarsOptions, GetTradeOptions } from './broker_interface';
export { GetOptionChainOptions, AuthData as TdaAuthData } from './tda';
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
    constructor(options: BrokerOptions);
    init(): Promise<[void, void]>;
    getAccount(broker?: BrokerChoice): Promise<Account[]>;
    getBars(options: GetBarsOptions): Promise<Map<string, Bar[]>>;
    getPositions(broker?: BrokerChoice): Promise<Position[]>;
    getQuotes(symbols: string[]): Promise<{
        [symbol: string]: import("types").Quote;
    }>;
    getOptionChain(options: tda.GetOptionChainOptions): Promise<import("types").OptionChain>;
    marketStatus(): Promise<MarketStatus>;
    private resolveBrokerChoice;
    private resolveMaybeBrokerChoice;
    waitForOrders(broker: BrokerChoice, options: WaitForOrdersOptions): Promise<Map<any, any>>;
}
