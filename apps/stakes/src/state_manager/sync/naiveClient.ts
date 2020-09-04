// Last-Write-Wins Sync with no special handling of concurrent modification
import each from 'lodash/each';
import isEmpty from 'lodash/isEmpty';
import debugMod from 'debug';
import { Dictionary } from 'lodash';
import { produce } from 'immer';
import {
  StateModification,
  StateType,
  Updatable,
  Versionable,
  StateHook,
} from '../types';
import { Machine, ErrorExecutionEvent, interpret, assign } from 'xstate';

const debug = debugMod('sync');

interface SyncItems {
  [id: string]: Versionable;
}

interface SyncStoreData {
  items: SyncItems;
}

interface SyncData {
  [store: string]: SyncStoreData;
}

interface SyncResults {
  state: {
    [store: string]: SyncItems;
  };
}

interface SyncMachineContext {
  pending: SyncData;
  sending: SyncData | null;
  sendBackoff: number;
  maxBackoff: number;
  errorNotifier?: (err: Error) => any;
  stores: Dictionary<Updatable<any, Versionable>>;
}

interface SyncMachineStates {
  states: {
    idle: {};
    sendSync: {};
    errorWait: {};
  };
}

interface SyncMachineAddEvent {
  type: 'ADD';
  item: StateModification<any>;
}

interface SyncMachineRecvStateEvent {
  type: 'IMPORT_STATE';
  data: {
    [store: string]: {
      [id: string]: Versionable;
    };
  };
}

interface SyncResultsEvent {
  type: 'done.invoke.sendSync';
  data: SyncResults;
}

type SyncMachineEvent =
  | SyncMachineAddEvent
  | SyncMachineRecvStateEvent
  | SyncResultsEvent
  | ErrorExecutionEvent;

export interface Syncable<SINGLETON extends boolean, T extends Versionable>
  extends Updatable<SINGLETON, T> {
  sync: StateHook;
}

export interface SyncMachineOptions {
  stores: Dictionary<Syncable<any, Versionable>>;
  sendUrl: string;
  recvUrl?: string;
}

export default function syncMachine({
  stores,
  sendUrl,
  recvUrl,
}: SyncMachineOptions) {
  const machine = Machine<
    SyncMachineContext,
    SyncMachineStates,
    SyncMachineEvent
  >(
    {
      id: 'sync-lww',
      initial: 'idle',
      states: {
        idle: {
          entry: 'clearBackoffTime',
          on: {
            '': [{ target: 'sendSync', cond: 'itemsPending' }],
            ADD: {
              actions: 'addItemToPending',
              target: 'sendSync',
            },
          },
        },
        sendSync: {
          entry: 'moveItemsToSending',
          invoke: {
            src: 'sendSync',
            onDone: {
              actions: [
                'clearBackoffTime',
                'clearSendingState',
                'applyReceivedState',
              ],
              target: 'idle',
            },
            onError: {
              actions: [
                'returnSendingToPending',
                'increaseBackoffTime',
                'notifyError',
              ],
              target: 'errorWait',
            },
          },
        },
        errorWait: {
          invoke: {
            src: 'waitForBackoffTime',
            onDone: 'idle',
          },
        },
      },
      on: {
        ADD: {
          actions: 'addItemToPending',
        },
        IMPORT_STATE: {
          actions: 'applyReceivedState',
        },
      },
      context: {
        pending: {},
        sending: null,
        sendBackoff: 0,
        maxBackoff: 5000,
        stores,
      },
    },
    {
      actions: {
        addItemToPending: assign<SyncMachineContext>({
          pending: (ctx, event) =>
            produce(ctx.pending, (draft) => {
              let { item } = event as SyncMachineAddEvent;
              let storeData = draft[item.storeName];
              if (!storeData) {
                draft[item.storeName] = {
                  items: item.value,
                };
              } else {
                if (item.singleton) {
                  storeData.items = item.value;
                } else {
                  storeData.items = {
                    ...storeData.items,
                    ...item.value,
                  };
                }
              }
            }),
        }),
        clearSendingState: assign<SyncMachineContext>({ sending: null }),
        moveItemsToSending: assign<SyncMachineContext>({
          sending: (ctx, event) => ctx.pending,
          pending: {},
        }),
        returnSendingToPending: assign<SyncMachineContext>({
          sending: null,
          pending: (ctx) =>
            produce(ctx.pending, (draft) => {
              // The send failed, so return all its data to the pending queue.
              each(ctx.sending, (sendingStore, storeName) => {
                let storeData = draft[storeName];
                if (!storeData) {
                  draft[storeName] = sendingStore;
                } else {
                  // Return the items that haven't changed again since we sent.
                  // We only do this in the dictionary case. For a singleton store we
                  // never return the item since the presence of this store's data at
                  // all means that the item has changed,
                  if (!ctx.stores[storeName].singleton) {
                    each(sendingStore.items, (item, id) => {
                      if (!storeData.items[id]) {
                        storeData.items[id] = item;
                      }
                    });
                  }
                }
              });
            }),
        }),
        applyReceivedState: (ctx, evt) => {
          // Copy the received state over the current state.
          let { data } = evt as SyncResultsEvent;
          each(data.state, (newData, storeName) => {
            let store = ctx.stores[storeName];
            if (!store) {
              // This shouldn't really happen but if it does, it means that this
              // client never created the store, so there's nothing to do.
              return;
            }

            store.update((draft) => {
              if (store.singleton) {
                return newData.version > draft.version ? newData : undefined;
              } else {
                each(newData, (item, id) => {
                  let currentVersion =
                    (draft as StateType<false, Versionable>)[id]?.version ?? -1;
                  if (currentVersion < item.version) {
                    (draft as StateType<false, Versionable>)[id] = item;
                  }
                });
              }
            });
          });
        },

        notifyError: (ctx, event) => {
          ctx.errorNotifier?.((event as ErrorExecutionEvent).data);
        },

        increaseBackoffTime: assign<SyncMachineContext>({
          sendBackoff: (ctx) =>
            Math.min(ctx.maxBackoff, ctx.sendBackoff * 2 || 100),
        }),
        clearBackoffTime: assign<SyncMachineContext>({ sendBackoff: 0 }),
      },
      guards: {
        itemsPending: (context) => !isEmpty(context.pending),
      },
      services: {
        sendSync: (ctx) => {
          let sendData: { [store: string]: { [id: string]: any } } = {};
          each(ctx.sending, (storeData, store) => {
            sendData[store] = storeData.items;
          });

          return fetch(sendUrl, {
            headers: {
              'content-type': 'application/json',
            },
            body: JSON.stringify(sendData),
            method: 'POST',
          }).then((r) => r.json());
        },
        waitForBackoffTime: (ctx) =>
          new Promise((resolve) => setTimeout(resolve, ctx.sendBackoff)),
      },
    }
  );

  let m = interpret(machine);

  var sse: EventSource;
  let sseActive = false;
  function createEventSource() {
    if (!recvUrl) {
      return;
    }

    sseActive = true;
    sse = new EventSource(recvUrl);
    sse.onmessage = (event) => {
      if (event.type === 'state') {
        m.send({ type: 'IMPORT_STATE', data: JSON.parse(event.data) });
      }
    };

    sse.onerror = function(err) {
      console.error(err);
      if (sseActive && this.readyState === EventSource.CLOSED) {
        createEventSource();
      }
    };
  }

  m.onEvent((event) => {
    debug('event', event);
  });

  m.onTransition((state) => {
    debug(state.toStrings().join(', '), state.context);
  });

  let started = false;
  let syncer = {
    add: (item: StateModification<any>) => m.send({ type: 'ADD', item }),
    start() {
      if (!started) {
        m.start();
      }

      // @ts-ignore
      if (process.browser) {
        createEventSource();
      }
    },
    stop() {
      if (!started) {
        return;
      }

      if (sse) {
        sseActive = false;
        sse.close();
      }

      if (started) {
        m.stop();
      }
      started = false;
    },
  };

  each(stores, (store) => {
    store.sync = syncer;
  });

  return syncer;
}
