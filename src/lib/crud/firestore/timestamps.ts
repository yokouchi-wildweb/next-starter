// src/lib/crud/firestore/timestamps.ts
// Admin SDK(firebase-admin/firestore)の Timestamp を Date に戻す(Server Components から Client Components へ渡せる形)。
// 再帰は lib/firestore の convertTimestampsWith

import { Timestamp } from "firebase-admin/firestore";
import { convertTimestampsWith } from "@/lib/firestore";

const isAdminTimestamp = (value: unknown): value is Timestamp => value instanceof Timestamp;

/**
 * FirestoreのTimestampオブジェクトをDateオブジェクトに再帰的に変換する
 */
export function convertTimestamps<T>(data: T): T {
  return convertTimestampsWith(data, isAdminTimestamp);
}
