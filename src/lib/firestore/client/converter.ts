// src/lib/firestore/client/converter.ts
//
// クライアント SDK の Firestore Timestamp を JS Date に再帰的に変換する。
// サーバー側 (lib/crud/firestore) と同ロジックだが、
// import 先がクライアント SDK (firebase/firestore) の Timestamp。

import { Timestamp } from "firebase/firestore";

/**
 * Firestore の Timestamp オブジェクトを Date に再帰的に変換する
 */
export function convertTimestamps<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (data instanceof Timestamp) return data.toDate() as T;
  if (Array.isArray(data)) return data.map(convertTimestamps) as T;
  if (typeof data === "object") {
    return Object.fromEntries(
      Object.entries(data as Record<string, unknown>).map(([k, v]) => [k, convertTimestamps(v)]),
    ) as T;
  }
  return data;
}
