import { Bar } from 'types';
export interface Technicals {
    ma50: number;
    ma200: number;
    ema9: number;
    ema10: number;
    ema12: number;
    ema21: number;
    ema26: number;
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
    prices: Bar[];
    fullDayToday: boolean;
    yesterday: Technicals;
    latest: number;
}
export interface TechnicalCalculator {
    symbol: string;
    prices: Bar[];
    fullDayToday: boolean;
    yesterday: Technicals;
    latest(latestPrice: number): LatestTechnicals;
}
export declare function createTechnicalCalculators(history: Map<string, Bar[]>): Map<string, TechnicalCalculator>;
