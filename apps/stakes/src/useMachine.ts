import { readable } from 'svelte/store';
import {
  interpret,
  StateMachine,
  StateSchema,
  EventObject,
  InterpreterOptions,
} from 'xstate';

export default function useMachine<
  TC,
  TS extends StateSchema,
  TE extends EventObject
>(machine: StateMachine<TC, TS, TE>, options?: Partial<InterpreterOptions>) {
  const service = interpret(machine, options);

  const store = readable<typeof machine.initialState>(
    machine.initialState,
    (set) => {
      service.onTransition((state) => {
        if (state.changed) {
          console.log(machine.id, state.toStrings());
          set(state);
        }
      });

      service.start();

      return () => service.stop();
    }
  );

  return {
    state: store,
    sendEvent: service.send,
    // Shortcut to build event handlers that send events to the machine.
    viewEvent: (event: TE) => {
      return () => service.send(event);
    },
  };
}
