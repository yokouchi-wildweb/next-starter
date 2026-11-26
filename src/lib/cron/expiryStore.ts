// src/lib/cron/expiryStore.ts
// 期限の削除の本物の表(drizzle、入口 @/lib/cron/server)。1 本の鍵と 1 束の DELETE、remove の項目の 1 束の鍵の SELECT(行の鍵なし)。判定と順は ./expiry.ts

import { sql } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import { expiryDeleteQuery, expirySelectKeysQuery, type ExpiryStore } from "./expiry";

/** db.execute の行(ドライバにより配列か { rows }) */
function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: unknown }).rows;
  return Array.isArray(rows) ? (rows as T[]) : [];
}

/** 本物の表(drizzle) */
export const drizzleExpiryStore: ExpiryStore = {
  async withTryLock(key, fn) {
    return db.transaction(async (tx) => {
      const result = await tx.execute(sql`SELECT pg_try_advisory_xact_lock(hashtextextended(${key}, 0)) AS locked`);
      if (rowsOf<{ locked: boolean }>(result)[0]?.locked !== true) return { locked: false as const };
      return { locked: true as const, value: await fn() };
    });
  },
  async deleteBatch(rule, batchSize, now) {
    const result = await db.execute(expiryDeleteQuery(rule, batchSize, now));
    return Number(rowsOf<{ n: number }>(result)[0]?.n ?? 0);
  },
  async selectKeys(rule, batchSize, now, afterKey) {
    const result = await db.execute(expirySelectKeysQuery(rule, batchSize, now, afterKey));
    return rowsOf<{ k: string }>(result).map((row) => String(row.k));
  },
};
