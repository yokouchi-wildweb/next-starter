// src/features/core/userCounter/services/server/wrappers/getCounters.ts

import type { UserCounter } from "@/features/core/userCounter/entities/model";
import { UserCounterTable } from "@/features/core/userCounter/entities/drizzle";
import { db } from "@/lib/drizzle";
import { and, asc, eq, inArray, like } from "drizzle-orm";

/** getCountersByPrefix の既定取得件数（全件取得防止のため必ず上限を設ける） */
const DEFAULT_PREFIX_LIMIT = 100;

/**
 * LIKE の前方一致用に prefix をエスケープする。
 * Postgres LIKE の既定 ESCAPE はバックスラッシュなので、`\` `%` `_` を `\` で打ち消す。
 */
function escapeLikePrefix(prefix: string): string {
  return prefix.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * 単一カウンタを取得する。存在しなければ null（カウント 0 とみなす）。
 */
export async function getCounter(userId: string, key: string): Promise<UserCounter | null> {
  const rows = await db
    .select()
    .from(UserCounterTable)
    .where(and(eq(UserCounterTable.user_id, userId), eq(UserCounterTable.counter_key, key)))
    .limit(1);
  return (rows[0] as UserCounter | undefined) ?? null;
}

/**
 * 複数キーをまとめて取得する。キー単位の Map で返す。
 * 存在しないキーは Map に含まれない（呼び出し側でカウント 0 とみなす）。
 */
export async function getCounters(
  userId: string,
  keys: string[],
): Promise<Map<string, UserCounter>> {
  const result = new Map<string, UserCounter>();
  if (keys.length === 0) return result;

  const rows = await db
    .select()
    .from(UserCounterTable)
    .where(and(eq(UserCounterTable.user_id, userId), inArray(UserCounterTable.counter_key, keys)));

  for (const row of rows as UserCounter[]) {
    result.set(row.counter_key, row);
  }
  return result;
}

/**
 * prefix 前方一致でカウンタ一覧を取得する（例: "secret_shop.dialog." で配下を一括読み）。
 *
 * per-user の複合ユニーク索引によりレンジ走査される。全件取得を避けるため limit を必須化
 * （既定 100）。一覧 UI は limit/offset で段階取得すること。
 */
export async function getCountersByPrefix(
  userId: string,
  prefix: string,
  options?: { limit?: number; offset?: number },
): Promise<UserCounter[]> {
  const limit = options?.limit ?? DEFAULT_PREFIX_LIMIT;
  const offset = options?.offset ?? 0;
  const pattern = `${escapeLikePrefix(prefix)}%`;

  const rows = await db
    .select()
    .from(UserCounterTable)
    .where(and(eq(UserCounterTable.user_id, userId), like(UserCounterTable.counter_key, pattern)))
    .orderBy(asc(UserCounterTable.counter_key))
    .limit(limit)
    .offset(offset);

  return rows as UserCounter[];
}
