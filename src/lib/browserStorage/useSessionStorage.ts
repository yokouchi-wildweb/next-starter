"use client";

import { useBrowserStorage } from "./useBrowserStorage";

/**
 * セッションストレージの値を取得・保存・削除するためのフック。
 *
 * @param key - ストレージのキー
 * @param fallbackValue - ストレージに値がない場合のデフォルト値
 * @returns [value, setValue, removeValue] のタプル
 *
 * @example
 * const [value, setValue, removeValue] = useSessionStorage("example-key", "fallbackValue");
 * setValue("保存したい値");
 * removeValue();
 */
export function useSessionStorage(key: string, fallbackValue = "") {
  return useBrowserStorage("session", key, fallbackValue);
}
