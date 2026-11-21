// src/lib/crud/firestore/timestamps.ts
// Firestore の Timestamp を Date に戻す(Server Components から Client Components へ渡せる形)

import { Timestamp } from "firebase-admin/firestore";

/**
 * FirestoreのTimestampオブジェクトをDateオブジェクトに再帰的に変換する
 * Server Components -> Client Componentsへのシリアライズを可能にする
 */
export function convertTimestamps<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (data instanceof Timestamp) return data.toDate() as T;
  if (Array.isArray(data)) return data.map(convertTimestamps) as T;
  if (typeof data === "object") {
    return Object.fromEntries(
      Object.entries(data as Record<string, unknown>).map(([k, v]) => [k, convertTimestamps(v)])
    ) as T;
  }
  return data;
}
