import { Brokers } from './brokers';
import { Bar } from 'types';
export declare function getPriceHistory(brokers: Brokers, symbols: string[], history?: number): Promise<Map<string, Bar[]>>;
