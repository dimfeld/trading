import { writable, Readable } from 'svelte/store';
import { produce } from 'immer';

export interface ImmerStore<T> {
  update: (updateFn: (draft: T) => T | void) => T;
  subscribe: Readable<T>['subscribe'];
}

export default function immerStore<T = any>(initialValue: T): ImmerStore<T> {
  let store = writable<T>(initialValue);

  let update = (updateFn: (draft: T) => T | void) => {
    let ret: T;
    store.update((value) => {
      ret = produce(value, updateFn) as T;
      return ret;
    });

    // @ts-ignore
    return ret as T;
  };

  return {
    update,
    subscribe: store.subscribe,
  };
}
