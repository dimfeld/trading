import { Broker, GetTradeOptions } from '../broker_interface';
import { Account, Position } from 'types';
import { Trade, Quote, OptionChain } from 'types';
export declare function optionInfoFromSymbol(symbol: string): {
    underlying: string;
    expiration: string;
    call: boolean;
    strike: number;
};
export declare function occToTdaSymbol(occ: string): string;
export declare function tdaToOccSymbol(tda: string): string;
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
export declare class Api implements Broker {
    auth: AuthData;
    access_token: string;
    accountId: string;
    autorefresh: boolean;
    constructor(auth: AuthData, autorefresh?: boolean);
    refreshAuth(): Promise<void>;
    init(): Promise<void>;
    private request;
    getOptionChain(options: GetOptionChainOptions): Promise<OptionChain>;
    getQuotes(symbols: string | string[]): Promise<{
        [symbol: string]: Quote;
    }>;
    getAccounts(): Promise<any>;
    getAccount(): Promise<Account>;
    getPositions(): Promise<Position[]>;
    getTransactionHistory(options?: GetTransactionsOptions): Promise<any>;
    getTrades(options?: GetTradeOptions): Promise<Trade[]>;
}
