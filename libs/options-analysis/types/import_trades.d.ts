import { DbPosition, DbTrade, DbTradeAndPosition } from 'types';
import { Change } from './position_simulator';
export interface PositionChange extends DbTradeAndPosition {
    change: Change;
}
export declare function applyTradeToPosition(position: DbPosition, trade: DbTrade): PositionChange;
export declare function recalculateMoney(trades: DbTrade[]): {
    cost_basis: number;
    profit: number;
};
