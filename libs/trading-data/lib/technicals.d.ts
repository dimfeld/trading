import { HistoricalPrice } from './historical';
export interface Technicals {
    ma50: number;
    ma200: number;
    ema10: number;
    ema21: number;
    rsi14: number;
    rsi20: number;
    bollinger: {
        upper1SD: number;
        lower1SD: number;
        upper2SD: number;
        lower2SD: number;
        upper3SD: number;
        lower3SD: number;
    };
}
export interface LatestTechnicals extends Technicals {
    symbol: string;
    prices: HistoricalPrice[];
    fullDayToday: boolean;
    yesterday: Technicals;
    latest: number;
}
export interface TechnicalCalculator {
    symbol: string;
    prices: HistoricalPrice[];
    fullDayToday: boolean;
    yesterday: Technicals;
    latest(latestPrice: number): LatestTechnicals;
}
export declare function createTechnicalCalculators(history: Map<string, HistoricalPrice[]>): Map<string, TechnicalCalculator>;
