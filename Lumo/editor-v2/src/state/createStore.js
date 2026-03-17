export function createStore(initialState) {
  const listeners = new Set();
  const state = initialState;

  return {
    getState() {
      return state;
    },
    setState(updater) {
      updater(state);
      for (const listener of listeners) listener(state);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
