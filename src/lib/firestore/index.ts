// src/lib/firestore/index.ts
// 入口 "."(client でも server でも読める): 共通の型と、SDK を読まない Timestamp の変換。SDK を読む操作は "./client"
export type { FirestoreClientError, Unsubscribe } from "./types";
export { convertTimestampsWith } from "./timestamps";
export type { TimestampLike } from "./timestamps";
