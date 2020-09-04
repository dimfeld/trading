import { Draft, Patch } from 'immer';
import { Dictionary } from 'lodash';

export interface Versionable {
  version: number;
}

export type StateType<
  SINGLETON extends boolean,
  T extends Versionable
> = SINGLETON extends true ? T : Dictionary<T>;

export interface BaseStateModification {
  storeName: string;
  patches: Patch[];
  inversePatches: Patch[];
}

export interface StateModification<
  SINGLETON extends boolean,
  T extends Versionable = any
> extends BaseStateModification {
  singleton: SINGLETON;
  value: StateType<SINGLETON, T>;
}

export interface StateHook {
  add(mod: StateModification<any>): void;
}

export interface UpdateResult<T> {
  values: T;
  patches: Patch[];
  inversePatches: Patch[];
}

export interface Updatable<SINGLETON extends boolean, T extends Versionable> {
  singleton: SINGLETON;
  update: (
    fn: (
      draft: Draft<StateType<SINGLETON, T>>
    ) => void | StateType<SINGLETON, T>,
    skip?: { [key: string]: boolean }
  ) => Promise<UpdateResult<StateType<SINGLETON, T>>>;
}
