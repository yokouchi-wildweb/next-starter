// src/features/core/userGroup/services/server/writes/versionWriter.ts
// 書きかけの版(user_group_versions の computing の行)に一員を束ごとに書く部品(D103)。
// 定期計算の版と、静的グループの置き換えの下書きが同じ形で使う。
// - 一員は利用者 id の昇順で書き、書き終えた最後の id を版の resume_after に持つ(時間が尽きたら次の回にそこから続ける)
// - 1 つの束 = 1 つの取引: 版の行を FOR UPDATE SKIP LOCKED で取り(並走する実行と重ならない)、削除されていない利用者だけを書き、
//   resume_after と member_count を進める
// - 生の SQL に JS の Date を入れない(時刻は Drizzle の演算子か now())

import { and, asc, desc, eq, gt, inArray, isNull, max, type SQL } from "drizzle-orm";

import { UserTable } from "@/features/core/user/entities/drizzle";
import { runBudgetedBatches } from "@/lib/cron";
import type { db as appDb, TransactionClient } from "@/lib/drizzle";

import { UserGroupVersionMemberTable, UserGroupVersionTable } from "../../../entities/drizzle";
import type { UserGroupVersion } from "../../../entities/model";

export type Executor = typeof appDb | TransactionClient;

/**
 * 利用者 id の供給: after より大きい id を昇順で最大 limit 件(after = null は先頭から)。空 = 終わり。
 * 静的グループの置き換えに fork の task が渡す(SQL で書けない条件で選んだ利用者を keyset で返す)
 */
export type UserIdSupplier = (after: string | null, limit: number) => Promise<readonly string[]>;

/** 1 つの束を書いた結果。null = 版の行を取れなかった(別の実行が書いている・もう computing でない) */
export type VersionBatchResult = {
  /** 供給が空だった(書き終えた) */
  done: boolean;
  /** この束で供給された id の数 */
  supplied: number;
  /** この束で版に入った人数 */
  written: number;
  /** 供給されたが入らなかった id(無い・削除された利用者、もう入っている) */
  skipped: number;
  /** 版の一員の数(この束の後) */
  memberCount: number;
};

/** db.execute の行(ドライバにより配列か { rows }) */
export function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: unknown }).rows;
  return Array.isArray(rows) ? (rows as T[]) : [];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 配列の供給(重複と uuid の形でない値を落とし、昇順に並べる) */
export function arraySupplier(userIds: readonly string[]): UserIdSupplier {
  const sorted = [...new Set(userIds.map((id) => id.toLowerCase()).filter((id) => UUID.test(id)))].sort();
  return async (after, limit) => {
    const start = after === null ? 0 : sorted.findIndex((id) => id > after);
    return start < 0 ? [] : sorted.slice(start, start + limit);
  };
}

/** グループの書きかけの版(無ければ null)。新しい番号の行を 1 つだけ見る */
export async function findComputingVersion(db: Executor, groupId: string): Promise<UserGroupVersion | null> {
  const [row] = await db
    .select()
    .from(UserGroupVersionTable)
    .where(and(eq(UserGroupVersionTable.group_id, groupId), eq(UserGroupVersionTable.status, "computing")))
    .orderBy(desc(UserGroupVersionTable.version))
    .limit(1);
  return row ?? null;
}

/** 書きかけの版を新しく作る(番号 = そのグループの最大 + 1。番号の UNIQUE が並走を止める) */
export async function createComputingVersion(db: Executor, groupId: string): Promise<UserGroupVersion> {
  const [top] = await db
    .select({ value: max(UserGroupVersionTable.version) })
    .from(UserGroupVersionTable)
    .where(eq(UserGroupVersionTable.group_id, groupId));
  const [row] = await db
    .insert(UserGroupVersionTable)
    .values({ group_id: groupId, version: (top?.value ?? 0) + 1, status: "computing", member_count: 0 })
    .returning();
  return row!;
}

/**
 * 1 つの束を書く(1 つの取引)。供給の id は after より大きい昇順であること(違えば投げる: 再開の位置が壊れるため)
 */
export async function writeVersionBatch(
  db: Executor,
  versionId: string,
  supplier: UserIdSupplier,
  batchSize: number,
): Promise<VersionBatchResult | null> {
  return db.transaction(async (tx) => {
    const [version] = await tx
      .select()
      .from(UserGroupVersionTable)
      .where(and(eq(UserGroupVersionTable.id, versionId), eq(UserGroupVersionTable.status, "computing")))
      .for("update", { skipLocked: true });
    if (!version) return null;
    const after = version.resume_after;
    const ids = await supplier(after, Math.max(1, Math.floor(batchSize)));
    const memberCount = version.member_count ?? 0;
    if (ids.length === 0) return { done: true, supplied: 0, written: 0, skipped: 0, memberCount };
    for (let i = 0; i < ids.length; i += 1) {
      const previous = i === 0 ? after : ids[i - 1]!;
      if (!UUID.test(ids[i]!) || (previous !== null && ids[i]! <= previous)) {
        throw new Error("利用者 id の供給は after より大きい id を昇順で返してください(再開の位置が壊れます)");
      }
    }
    const valid = await tx
      .select({ id: UserTable.id })
      .from(UserTable)
      .where(and(inArray(UserTable.id, [...ids]), isNull(UserTable.deletedAt)))
      .orderBy(asc(UserTable.id));
    const inserted =
      valid.length === 0
        ? []
        : await tx
            .insert(UserGroupVersionMemberTable)
            .values(valid.map((row) => ({ version_id: versionId, user_id: row.id })))
            .onConflictDoNothing()
            .returning({ id: UserGroupVersionMemberTable.user_id });
    const nextCount = memberCount + inserted.length;
    await tx
      .update(UserGroupVersionTable)
      .set({ resume_after: ids[ids.length - 1]!, member_count: nextCount })
      .where(eq(UserGroupVersionTable.id, versionId));
    return { done: false, supplied: ids.length, written: inserted.length, skipped: ids.length - inserted.length, memberCount: nextCount };
  });
}

/** 版の一員の利用者 id(after より大きい昇順。定期計算と下書きの検査が読む) */
export async function versionMemberIdsAfter(db: Executor, versionId: string, after: string | null, limit: number): Promise<string[]> {
  const rows = await db
    .select({ id: UserGroupVersionMemberTable.user_id })
    .from(UserGroupVersionMemberTable)
    .where(and(eq(UserGroupVersionMemberTable.version_id, versionId), after ? gt(UserGroupVersionMemberTable.user_id, after) : undefined))
    .orderBy(asc(UserGroupVersionMemberTable.user_id))
    .limit(limit);
  return rows.map((row) => row.id);
}

/** 生の SQL の数を数える CTE の結果 */
export async function countOfExecute(tx: TransactionClient, query: SQL): Promise<number> {
  const [row] = rowsOf<{ n: number | string }>(await tx.execute(query));
  return Number(row?.n ?? 0);
}

/** 書きかけの版を締切まで書いた結果 */
export type VersionWriteOutcome = {
  /** done = 書き終えた / stopped = 締切・束の上限で止めた(続きは次に)/ locked = 別の実行が書いている / over_limit = 人数の上限を超えた */
  outcome: "done" | "stopped" | "locked" | "over_limit";
  memberCount: number;
  written: number;
  skipped: number;
};

/**
 * 書きかけの版を締切まで束ごとに書く(runBudgetedBatches)。人数が memberLimit を超えた束で止める(over_limit)。
 * 締切が過ぎていても最初の 1 束は書く(呼ぶたびに必ず進む = 続きの呼び出しを繰り返せば終わる)
 */
export async function writeVersionUntil(
  db: Executor,
  versionId: string,
  supplier: UserIdSupplier,
  options: { batchSize: number; memberLimit: number; deadline: Date; maxChunks?: number },
): Promise<VersionWriteOutcome> {
  let outcome: VersionWriteOutcome["outcome"] = "stopped";
  let memberCount = 0;
  let written = 0;
  let skipped = 0;
  let batches = 0;
  /** 1 束を書いて続けるか(false = 終わり・取れない・上限) */
  const step = async (): Promise<VersionBatchResult | null> => {
    const result = await writeVersionBatch(db, versionId, supplier, options.batchSize);
    if (!result) {
      outcome = "locked";
      return null;
    }
    memberCount = result.memberCount;
    written += result.written;
    skipped += result.skipped;
    if (result.done) {
      outcome = "done";
      return null;
    }
    batches += 1;
    if (result.memberCount > options.memberLimit) {
      outcome = "over_limit";
      return null;
    }
    return result;
  };
  if (!(await step())) return { outcome, memberCount, written, skipped };
  if (options.maxChunks !== undefined && batches >= options.maxChunks) return { outcome, memberCount, written, skipped };
  await runBudgetedBatches<VersionBatchResult, number>({
    deadline: options.deadline,
    maxChunks: options.maxChunks === undefined ? undefined : options.maxChunks - batches,
    fetchNext: async () => {
      const result = await step();
      return result ? { items: [result], cursor: batches } : null;
    },
    processChunk: async () => {},
  });
  return { outcome, memberCount, written, skipped };
}
