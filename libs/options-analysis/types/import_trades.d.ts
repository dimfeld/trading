import { DbPosition, DbTrade, DbTradeAndPosition, Order } from 'types';
import { Change } from './position_simulator';
export interface PositionChange extends DbTradeAndPosition {
    change: Change;
}
export declare function orderGross(order: Order): number;
export declare function orderToDbTrade(order: Order): {
    underlying: string;
    trade: DbTrade;
    broker: import("types").BrokerChoice;
};
export declare function applyTradeToPosition(position: DbPosition, trade: DbTrade): PositionChange;
export declare function recalculateMoney(trades: DbTrade[]): {
    cost_basis: number;
    profit: number;
};
