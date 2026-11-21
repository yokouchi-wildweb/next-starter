// src/lib/firestore/client/converter.ts
// クライアント SDK(firebase/firestore)の Timestamp を Date に戻す。再帰は "." の convertTimestampsWith

import { Timestamp } from "firebase/firestore";
import { convertTimestampsWith } from "../timestamps";

const isClientTimestamp = (value: unknown): value is Timestamp => value instanceof Timestamp;

/**
 * Firestore の Timestamp オブジェクトを Date に再帰的に変換する
 */
export function convertTimestamps<T>(data: T): T {
  return convertTimestampsWith(data, isClientTimestamp);
}
