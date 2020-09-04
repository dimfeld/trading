export interface HistoricalPrice {
    date: Date;
    price: number;
}
export declare function getPriceHistory(symbol: string, history?: number): Promise<HistoricalPrice[]>;
