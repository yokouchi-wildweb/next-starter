"use client";

import { useCallback, useState } from "react";
import type { SetStateAction } from "react";

type SafeStateSetter<State> = (value: SetStateAction<State>, isMounted: boolean) => void;

/**
 * `useState` の安全なラッパー。
 * `setState` 呼び出し時に `isMounted` が `true` の場合のみステートを更新します。
 */
export function useSafeState<State>(
  initialState: State | (() => State),
): readonly [State, SafeStateSetter<State>] {
  const [state, setState] = useState(initialState);

  const safeSetter = useCallback<SafeStateSetter<State>>(
    (value, isMounted) => {
      if (!isMounted) {
        return;
      }

      setState(value);
    },
    [setState],
  );

  return [state, safeSetter] as const;
}
