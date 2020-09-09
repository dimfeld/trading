import { HistoricalPrice } from './historical';
import { Quote } from 'types';
export interface Technicals {
    prices: HistoricalPrice[];
    ema10: number;
    ema21: number;
    ma50: number;
    ma200: number;
}
export default function (history: Map<string, HistoricalPrice[]>, quotes?: {
    [symbol: string]: Quote;
}): Promise<Map<string, Technicals>>;
