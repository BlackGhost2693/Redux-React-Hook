// Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved

import {createContext, useContext, useEffect, useRef, useState} from 'react';
import {Action, Dispatch, Store} from 'redux';
import shallowEqual from './shallowEqual';

export const StoreContext = createContext<Store<any> | null>(null);

const CONTEXT_ERROR_MESSAGE =
  'redux-react-hook requires your Redux store to ' +
  'be passed through context via the <StoreContext.Provider>';

/**
 * Your passed in mapState function should be memoized with useCallback to avoid
 * resubscribing every render. If you don't use other props in mapState, pass
 * an empty array [] as the dependency list so the callback isn't recreated
 * every render.
 *
 * const todo = useMappedState(useCallback(
 *   state => state.todos.get(id),
 *   [id],
 * ));
 */
export function useMappedState<TState, TResult>(
  mapState: (state: TState) => TResult,
): TResult {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error(CONTEXT_ERROR_MESSAGE);
  }
  const runMapState = () => mapState(store.getState());

  const [derivedState, setDerivedState] = useState(() => runMapState());

  // If the store or mapState change, rerun mapState
  const [prevStore, setPrevStore] = useState(store);
  const [prevMapState, setPrevMapState] = useState(() => mapState);
  if (prevStore !== store || prevMapState !== mapState) {
    setPrevStore(store);
    setPrevMapState(() => mapState);
    setDerivedState(runMapState());
  }

  // We use a ref to store the last result of mapState in local component
  // state. This way we can compare with the previous version to know if
  // the component should re-render. Otherwise, we'd have pass derivedState
  // in the array of memoization paramaters to the second useEffect below,
  // which would cause it to unsubscribe and resubscribe from Redux every time
  // the state changes.
  const lastRenderedDerivedState = useRef(derivedState);
  // Set the last mapped state after rendering.
  useEffect(() => {
    lastRenderedDerivedState.current = derivedState;
  });

  useEffect(
    () => {
      // Run the mapState callback and if the result has changed, make the
      // component re-render with the new state.
      const checkForUpdates = () => {
        const newDerivedState = runMapState();
        if (!shallowEqual(newDerivedState, lastRenderedDerivedState.current)) {
          setDerivedState(newDerivedState);
        }
      };

      // Pull data from the store on first render.
      checkForUpdates();

      // Subscribe to the store to be notified of subsequent changes.
      const unsubscribe = store.subscribe(checkForUpdates);

      // The return value of useEffect will be called when unmounting, so
      // we use it to unsubscribe from the store.
      return unsubscribe;
    },
    [store, mapState],
  );

  return derivedState;
}

export function useDispatch<TAction extends Action>(): Dispatch<TAction> {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error(CONTEXT_ERROR_MESSAGE);
  }
  return store.dispatch;
}
