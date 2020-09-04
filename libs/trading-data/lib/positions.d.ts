import { DbData, IPosition } from './types';
export declare function load(): Promise<DbData>;
export declare function write_positions(positions: IPosition[]): Promise<any>;
export declare const tradeColumns: import("pg-promise").ColumnSet;