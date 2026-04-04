// src/hooks/useAsyncAction.ts

"use client";

import { useCallback, useRef, useState } from "react";

/**
 * 非同期アクションの並行実行を防ぐフック。
 * useRef による排他ロックで、ダブルタップ等による二重発火を確実に防止する。
 *
 * @example
 * const { execute: handleDelete, isExecuting } = useAsyncAction(
 *   async (id: string) => { await deleteItem(id); }
 * );
 *
 * <Button onClick={() => handleDelete(id)} disabled={isExecuting}>削除</Button>
 */
export function useAsyncAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
) {
  const lockRef = useRef(false);
  const actionRef = useRef(action);
  actionRef.current = action;

  const [isExecuting, setIsExecuting] = useState(false);

  const execute = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      if (lockRef.current) return undefined;

      lockRef.current = true;
      setIsExecuting(true);

      try {
        return await actionRef.current(...args);
      } finally {
        lockRef.current = false;
        setIsExecuting(false);
      }
    },
    [],
  );

  return { execute, isExecuting } as const;
}
