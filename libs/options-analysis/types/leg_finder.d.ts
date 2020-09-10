import { ContractInfo } from 'types';
export declare type StrikeMap = {
    [key: string]: ContractInfo[];
};
export declare type ExpirationDateMap = {
    [key: string]: StrikeMap;
};
export declare function closestDeltas(strikes: StrikeMap, deltas: number[]): {
    target: number;
    contract: ContractInfo;
    contracts: ContractInfo[];
}[];
interface ClosestDte {
    target: number;
    dte: number;
    expiration: string;
    difference: number;
    strikes: StrikeMap;
}
export declare function closestAfterDte(dates: ExpirationDateMap, dteTarget: string[]): ClosestDte[];
export interface AnalyzeSideOptions {
    dte: string[];
    delta: number[];
}
export declare function analyzeSide(config: AnalyzeSideOptions, allExpirations: ExpirationDateMap): {
    target: number;
    dte: number;
    expiration: string;
    difference: number;
    strikes: StrikeMap;
    deltas: {
        target: number;
        contract: ContractInfo;
        contracts: ContractInfo[];
    }[];
}[];
export interface FilterLiquidityArguments {
    maxSpreadPercent?: number;
    minVolume?: number;
    minOpenInterest?: number;
}
export interface LiquidityInfo {
    spreadPercent?: number;
    totalVolume?: number;
    openInterest?: number;
}
export declare function filterLiquidity(config: FilterLiquidityArguments, data: LiquidityInfo): boolean;
export interface AnalyzeLiquidityOptions {
    symbol: string;
    callExpDateMap: ExpirationDateMap;
    putExpDateMap: ExpirationDateMap;
}
export declare function analyzeLiquidity(config: AnalyzeSideOptions & FilterLiquidityArguments, chain: AnalyzeLiquidityOptions): {
    symbol: string;
    results: any[];
};
export {};
