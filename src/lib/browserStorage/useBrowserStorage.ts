"use client";

import { useCallback, useEffect, useState } from "react";

import { createStorageClient } from "./clientService";
import type { StorageType } from "./types";

/**
 * ブラウザストレージの値を取得・保存・削除するための共通フック。
 *
 * @param type - ストレージの種類 ("local" | "session")
 * @param key - ストレージのキー
 * @param fallbackValue - ストレージに値がない場合のデフォルト値
 * @returns [value, setValue, removeValue] のタプル
 *
 * @example
 * const [value, setValue, removeValue] = useBrowserStorage("local", "my-key", "default");
 * setValue("新しい値");
 * removeValue();
 */
export function useBrowserStorage(
  type: StorageType,
  key: string,
  fallbackValue = "",
) {
  const [value, setValue] = useState(fallbackValue);

  useEffect(() => {
    const client = createStorageClient(type);
    try {
      const storedValue = client.load(key);
      if (storedValue !== null) {
        setValue(storedValue);
        return;
      }
    } catch (error) {
      console.warn(`Failed to load value from ${type}Storage.`, error);
    }

    setValue(fallbackValue);
  }, [type, key, fallbackValue]);

  const updateValue = useCallback(
    (nextValue: string) => {
      setValue(nextValue);
      const client = createStorageClient(type);
      try {
        client.save(key, nextValue);
      } catch (error) {
        console.warn(`Failed to save value to ${type}Storage.`, error);
      }
    },
    [type, key],
  );

  const removeValue = useCallback(() => {
    setValue(fallbackValue);
    const client = createStorageClient(type);
    try {
      client.remove(key);
    } catch (error) {
      console.warn(`Failed to remove value from ${type}Storage.`, error);
    }
  }, [type, key, fallbackValue]);

  return [value, updateValue, removeValue] as const;
}
