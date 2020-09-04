// Last-Write-Wins Sync
import each from 'lodash/each';
import isEmpty from 'lodash/isEmpty';
import keys from 'lodash/keys';
import { Dictionary } from 'lodash';
import { produce, Patch, applyPatches } from 'immer';
import { StateModification, StateType, Updatable, Versionable } from '../types';
import { Machine, ErrorExecutionEvent, interpret, assign } from 'xstate';

interface SyncItems {
  [id: string]: Versionable;
}

interface SyncStoreData {
  patches: Patch[];
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

export interface SyncMachineOptions {
  stores: Dictionary<Updatable<any, Versionable>>;
  sendUrl: string;
  recvUrl: string;
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
                  patches: item.patches,
                  items: item.value,
                };
              } else {
                storeData.patches.push(...item.patches);
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
          sending: null,
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
                  storeData.patches = [
                    ...sendingStore.patches,
                    ...storeData.patches,
                  ];

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

            let returnedKeys = new Set(keys(newData));

            // If we have modified the data locally, apply those patches.
            let sendingItems = ctx.sending?.[storeName]?.patches;
            let pendingItems = ctx.pending[storeName]?.patches;
            if (sendingItems || pendingItems) {
              let patches = (sendingItems || []).concat(pendingItems || []);

              if (!store.singleton) {
                // Filter down to only the keys we got data for.
                let idFilter = (p: Patch) =>
                  returnedKeys.has(p.path[0] as string);
                patches = patches.filter(idFilter);
              }

              if (patches.length) {
                newData = applyPatches(newData, patches);
              }
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
  m.start();

  var sse: EventSource;
  let sseActive = false;
  function createEventSource() {
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

  return {
    add: (item: StateModification<any>) => m.send({ type: 'ADD', item }),
    start() {
      sseActive = true;
      m.start();
      createEventSource();
    },
    stop() {
      if (sse) {
        sseActive = false;
        sse.close();
      }
      m.stop();
    },
  };
}
