import { BrokerChoice } from 'types';
import { OptionLeg } from './types';
export interface HasOptionLegs {
    legs: OptionLeg[];
}
export interface HasOptionLegsAndBroker extends HasOptionLegs {
    broker: BrokerChoice;
}
export interface MatchingPositionScore<T> {
    score: number;
    overlapping: number;
    position: T;
}
export declare function matchPositions<T extends HasOptionLegsAndBroker>(broker: BrokerChoice, trade: HasOptionLegs, positions: T[]): Array<MatchingPositionScore<T>>;
