"use client";

import { useBrowserStorage } from "./useBrowserStorage";

/**
 * ローカルストレージの値を取得・保存・削除するためのフック。
 *
 * @param key - ストレージのキー
 * @param fallbackValue - ストレージに値がない場合のデフォルト値
 * @returns [value, setValue, removeValue] のタプル
 *
 * @example
 * const [value, setValue, removeValue] = useLocalStorage("example-key", "fallbackValue");
 * setValue("保存したい値");
 * removeValue();
 */
export function useLocalStorage(key: string, fallbackValue = "") {
  return useBrowserStorage("local", key, fallbackValue);
}
