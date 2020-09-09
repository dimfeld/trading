import { Brokers } from './brokers';
export interface HistoricalPrice {
    date: Date;
    /** Price as an integer. Divide by 100 to get actual price. */
    price: number;
    volume: number;
}
export declare function getPriceHistory(brokers: Brokers, symbols: string[], history?: number): Promise<Map<string, HistoricalPrice[]>>;
