"use client";

import { useCallback, useEffect, useState } from "react";

import {
  loadFromLocalStorage,
  removeFromLocalStorage,
  saveToLocalStorage,
} from "./clientService";

/**
 * ローカルストレージの値を取得・保存・削除するためのシンプルなフック。
 *
 * ```tsx
 * const [value, setValue, removeValue] = useLocalStorage("example-key", "fallbackValue");
 * setValue("保存したい値");
 * removeValue();
 * ```
 *
 * のように呼び出すと、`value` に保存済みのデータが入り、
 * `setValue` で更新すると自動的にローカルストレージへ保存されます。
 * `removeValue` を呼び出すとローカルストレージの値を削除し、
 * hook の状態も `fallbackValue` に戻ります。
 * ストレージにデータが存在しない場合は fallbackValue が value に入ります。
 */
export function useLocalStorage(key: string, fallbackValue = "") {
  const [value, setValue] = useState(fallbackValue);

  useEffect(() => {
    try {
      const storedValue = loadFromLocalStorage(key);
      if (storedValue !== null) {
        setValue(storedValue);
        return;
      }
    } catch (error) {
      console.warn("Failed to load value from localStorage.", error);
    }

    setValue(fallbackValue);
  }, [fallbackValue, key]);

  const updateValue = useCallback(
    (nextValue: string) => {
      setValue(nextValue);
      try {
        saveToLocalStorage(key, nextValue);
      } catch (error) {
        console.warn("Failed to save value to localStorage.", error);
      }
    },
    [key],
  );

  const removeValue = useCallback(() => {
    setValue(fallbackValue);
    try {
      removeFromLocalStorage(key);
    } catch (error) {
      console.warn("Failed to remove value from localStorage.", error);
    }
  }, [fallbackValue, key]);

  return [value, updateValue, removeValue] as const;
}
