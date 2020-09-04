import UndoStateHook from './undo';
import { Dictionary } from 'lodash';
import { Readable, writable } from 'svelte/store';
import {
  StateHook,
  StateType,
  Versionable,
  Updatable,
  UpdateResult,
  StateModification,
} from './types';
import { Draft, produceWithPatches } from 'immer';

export const allStores: Map<string, State<any, any>> = new Map();

export interface StateOptions {
  undo?: UndoStateHook;
  sync?: StateHook;
}

export class State<SINGLETON extends boolean, T extends Versionable> {
  name: string;
  singleton: SINGLETON;
  store: Updatable<SINGLETON, T>;
  undo?: UndoStateHook;
  sync?: StateHook;

  constructor(
    name: string,
    singleton: SINGLETON,
    store: Updatable<SINGLETON, T>,
    options: StateOptions = {}
  ) {
    this.name = name;
    this.singleton = singleton;
    this.store = store;
    this.undo = options.undo;
    this.sync = options.sync;

    allStores.set(name, this);
  }

  async update(
    updateFn: (
      draft: Draft<StateType<SINGLETON, T>>
    ) => StateType<SINGLETON, T> | void,
    skip: { undo?: boolean; sync?: boolean } = {}
  ) {
    let result = await this.store.update(updateFn);

    let newValues: StateType<SINGLETON, T> = result.values;
    if (!this.singleton) {
      let modifiedItems: Dictionary<T | null> = {};
      result.patches.forEach((patch) => {
        let id = patch.path[0];
        let value = (result.values as Dictionary<T>)[id];
        modifiedItems[id] = value === undefined ? null : value;
      });

      newValues = modifiedItems as StateType<SINGLETON, T>;
    }

    let stateMod: StateModification<SINGLETON, T> = {
      singleton: this.singleton as SINGLETON,
      storeName: this.name,
      patches: result.patches,
      inversePatches: result.inversePatches,
      value: newValues,
    };

    if (this.undo && !skip.undo) {
      this.undo.add(stateMod);
    }

    if (this.sync && !skip.sync) {
      this.sync.add(stateMod);
    }
    return result;
  }
}

export class SvelteStore<
  SINGLETON extends boolean,
  T extends Versionable
> extends State<SINGLETON, T> {
  store: ImmerStore<SINGLETON, T>;
  subscribe: Readable<StateType<SINGLETON, T>>['subscribe'];

  constructor(
    name: string,
    singleton: SINGLETON,
    initialState: StateType<SINGLETON, T>,
    hooks?: StateOptions
  ) {
    let store = immerStore<SINGLETON, T>(singleton, initialState);

    super(name, singleton, store, hooks);
    this.store = store;
    this.subscribe = store.subscribe;
  }
}

export interface ImmerStore<SINGLETON extends boolean, T extends Versionable> {
  singleton: SINGLETON;
  update: (
    fn: (
      draft: Draft<StateType<SINGLETON, T>>
    ) => void | StateType<SINGLETON, T>
  ) => Promise<UpdateResult<StateType<SINGLETON, T>>>;
  subscribe: Readable<StateType<SINGLETON, T>>['subscribe'];
}

export function immerStore<SINGLETON extends boolean, T extends Versionable>(
  singleton: SINGLETON,
  initialValue: StateType<SINGLETON, T>
): ImmerStore<SINGLETON, T> {
  let store = writable<StateType<SINGLETON, T>>(initialValue);

  let update = (
    updateFn: (
      draft: Draft<StateType<SINGLETON, T>>
    ) => StateType<SINGLETON, T> | void
  ): Promise<UpdateResult<StateType<SINGLETON, T>>> => {
    return new Promise((resolve) => {
      store.update((value) => {
        let result = produceWithPatches(value, updateFn);
        resolve({
          values: result[0] as StateType<SINGLETON, T>,
          patches: result[1],
          inversePatches: result[2],
        });
        return result[0] as StateType<SINGLETON, T>;
      });
    });
  };

  return {
    singleton,
    update,
    subscribe: store.subscribe,
  };
}
