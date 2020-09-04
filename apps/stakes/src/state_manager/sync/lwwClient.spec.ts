import { Dictionary } from 'lodash';
import { Updatable, Versionable } from '../types';
import { Draft, produceWithPatches } from 'immer';
// import EventSource from 'eventsourcemock';

jest.useFakeTimers();

function mockSingleton<T extends Versionable>(): Updatable<true, T> {
  let value: T;

  return {
    singleton: true,
    update: (updater: (draft: Draft<T>) => void | T) => {
      let result = produceWithPatches(value, updater);
      value = result[0] as T;

      return Promise.resolve({
        values: value as T,
        patches: result[1],
        inversePatches: result[2],
      });
    },
  };
}

function mockDictStore<T extends Versionable>(): Updatable<false, T> {
  let value: Dictionary<T> = {};

  return {
    singleton: false,
    update: (
      updater: (draft: Draft<Dictionary<T>>) => void | Dictionary<T>
    ) => {
      let result = produceWithPatches(value, updater);
      value = result[0] as Dictionary<T>;

      return Promise.resolve({
        values: value as Dictionary<T>,
        patches: result[1],
        inversePatches: result[2],
      });
    },
  };
}

test('sends an added event');
