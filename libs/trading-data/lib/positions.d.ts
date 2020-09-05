import { DbData, DbPosition, DbTrade } from 'types';
export declare function loadDb(): Promise<DbData>;
export declare const positionColumns: import("pg-promise").ColumnSet;
export declare function writePositions(positions: DbPosition[], trades: DbTrade[]): Promise<any>;
export declare const tradeColumns: import("pg-promise").ColumnSet;
