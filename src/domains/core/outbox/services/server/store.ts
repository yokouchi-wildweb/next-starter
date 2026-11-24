// src/domains/core/outbox/services/server/store.ts
// 送り箱の表の読み書き(drizzle)。積むのは呼び手の取引(tx)で、取る・進めるは自分の取引で。
// - 取る: SELECT … FOR UPDATE SKIP LOCKED で行を持ち、running と貸しの期限を付ける(並走する押し・定期処理と重ならない)
// - 時の来た pending と、貸しの切れた running だけを取る
// - 定期処理の 1 本: 外の取引で pg_try_advisory_xact_lock を取り、取れなければ待たずに抜ける。外の取引は行の鍵を持たない
//   (取る・進めるは別の接続。pool の max は 3 が既定: 外の取引 1 + 取る 1 + 処理 1)

import { and, eq, inArray, isNotNull, lt, lte, or, sql } from "drizzle-orm";

import { db, type TransactionClient } from "@/lib/drizzle";

import { OutboxJobTable } from "../../entities/drizzle";
import type { OutboxJobRow } from "../../entities/model";
import type { OutboxKind } from "../../points";

/** 貸しの長さ(処理 1 回の上限の目安。切れた running は取り直せる) */
export const OUTBOX_LEASE_MS = 5 * 60 * 1000;

export type OutboxInsert = { kind: OutboxKind; payload: Record<string, unknown>; idempotencyKey: string; notBefore?: Date };

/** kind ごとの状態の数(監視) */
export type OutboxKindCounts = { kind: OutboxKind; pending: number; quarantined: number; oldestPendingAt: Date | null };

/** 隔離から戻す行の絞り(無い欄は絞らない) */
export type OutboxReprocessFilter = { kinds?: readonly OutboxKind[]; ids?: readonly string[] };

export type OutboxStore<Tx> = {
  /** 呼び手の取引で 1 行積む。同じ (kind, idempotencyKey) が在れば積まずにその id */
  insert(tx: Tx, row: OutboxInsert): Promise<{ id: string; duplicate: boolean }>;
  /** 時の来た 1 行を取る(取れなければ null) */
  claim(id: string, now: Date): Promise<OutboxJobRow | null>;
  /** 時の来た行を kind で絞って古い順に limit 行まで取る(kinds が空なら取らない) */
  claimBatch(kinds: readonly OutboxKind[], limit: number, now: Date): Promise<OutboxJobRow[]>;
  /** 届けた */
  markDone(id: string, now: Date): Promise<void>;
  /** 処理が無い(閉じたドメインの kind): 試行を数えずに待ちへ戻す(保留) */
  release(id: string, now: Date): Promise<void>;
  /** 未設定の基底で回せない: 試行を数えずに次の時刻だけ延ばす(保留) */
  hold(id: string, error: string, nextAttemptAt: Date, now: Date): Promise<void>;
  /** 失敗: 試行を 1 足して次の時刻の待ちへ */
  markFailed(id: string, error: string, nextAttemptAt: Date, now: Date): Promise<void>;
  /** 上限の失敗: 試行を 1 足して隔離(消さない) */
  markQuarantined(id: string, error: string, now: Date): Promise<void>;
  /** 定期処理を 1 本に絞る。取れなければ fn を呼ばずに { locked: false } */
  withRunnerLock<T>(key: string, fn: () => Promise<T>): Promise<{ locked: true; value: T } | { locked: false }>;
  /** kind ごとの待ち(pending・running)・隔離の数と一番古い待ちの積んだ時 */
  countByKind(): Promise<OutboxKindCounts[]>;
  /** 隔離の行を待ちへ戻す(試行 0・今すぐ)。戻した行の数。隔離でない行は触らない(何度流しても同じ) */
  reprocess(filter: OutboxReprocessFilter, now: Date): Promise<number>;
};

/** db.execute の行(ドライバにより配列か { rows }) */
function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: unknown }).rows;
  return Array.isArray(rows) ? (rows as T[]) : [];
}

/** 時の来た pending か、貸しの切れた running */
const dueWhere = (now: Date) =>
  or(
    and(eq(OutboxJobTable.status, "pending"), lte(OutboxJobTable.next_attempt_at, now)),
    and(eq(OutboxJobTable.status, "running"), isNotNull(OutboxJobTable.lease_until), lt(OutboxJobTable.lease_until, now)),
  );

export const drizzleOutboxStore: OutboxStore<TransactionClient> = {
  async insert(tx, row) {
    const [inserted] = await tx
      .insert(OutboxJobTable)
      .values({
        kind: row.kind,
        payload: row.payload,
        idempotency_key: row.idempotencyKey,
        ...(row.notBefore ? { next_attempt_at: row.notBefore } : {}),
      })
      .onConflictDoNothing({ target: [OutboxJobTable.kind, OutboxJobTable.idempotency_key] })
      .returning({ id: OutboxJobTable.id });
    if (inserted) return { id: inserted.id, duplicate: false };
    const [existing] = await tx
      .select({ id: OutboxJobTable.id })
      .from(OutboxJobTable)
      .where(and(eq(OutboxJobTable.kind, row.kind), eq(OutboxJobTable.idempotency_key, row.idempotencyKey)))
      .limit(1);
    if (!existing) throw new Error(`outbox: ${row.kind} の重複の行が読めない`);
    return { id: existing.id, duplicate: true };
  },

  async claim(id, now) {
    return db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(OutboxJobTable)
        .where(and(eq(OutboxJobTable.id, id), dueWhere(now)))
        .limit(1)
        .for("update", { skipLocked: true });
      if (!row) return null;
      const leaseUntil = new Date(now.getTime() + OUTBOX_LEASE_MS);
      await tx.update(OutboxJobTable).set({ status: "running", lease_until: leaseUntil, updated_at: now }).where(eq(OutboxJobTable.id, id));
      return { ...row, status: "running", lease_until: leaseUntil };
    });
  },

  async claimBatch(kinds, limit, now) {
    if (kinds.length === 0 || limit <= 0) return [];
    const leaseUntil = new Date(now.getTime() + OUTBOX_LEASE_MS);
    const due = db
      .select({ id: OutboxJobTable.id })
      .from(OutboxJobTable)
      .where(and(inArray(OutboxJobTable.kind, [...kinds]), dueWhere(now)))
      .orderBy(OutboxJobTable.next_attempt_at)
      .limit(limit)
      .for("update", { skipLocked: true });
    return db
      .update(OutboxJobTable)
      .set({ status: "running", lease_until: leaseUntil, updated_at: now })
      .where(inArray(OutboxJobTable.id, due))
      .returning();
  },

  async markDone(id, now) {
    await db.update(OutboxJobTable).set({ status: "done", lease_until: null, done_at: now, updated_at: now }).where(eq(OutboxJobTable.id, id));
  },

  async release(id, now) {
    await db.update(OutboxJobTable).set({ status: "pending", lease_until: null, updated_at: now }).where(eq(OutboxJobTable.id, id));
  },

  async hold(id, error, nextAttemptAt, now) {
    await db
      .update(OutboxJobTable)
      .set({ status: "pending", lease_until: null, next_attempt_at: nextAttemptAt, last_error: error, updated_at: now })
      .where(eq(OutboxJobTable.id, id));
  },

  async markFailed(id, error, nextAttemptAt, now) {
    await db
      .update(OutboxJobTable)
      .set({
        status: "pending",
        lease_until: null,
        attempts: sql`${OutboxJobTable.attempts} + 1`,
        next_attempt_at: nextAttemptAt,
        last_error: error,
        updated_at: now,
      })
      .where(eq(OutboxJobTable.id, id));
  },

  async markQuarantined(id, error, now) {
    await db
      .update(OutboxJobTable)
      .set({
        status: "quarantined",
        lease_until: null,
        attempts: sql`${OutboxJobTable.attempts} + 1`,
        last_error: error,
        quarantined_at: now,
        updated_at: now,
      })
      .where(eq(OutboxJobTable.id, id));
  },

  async withRunnerLock(key, fn) {
    return db.transaction(async (tx) => {
      const result = await tx.execute(sql`SELECT pg_try_advisory_xact_lock(hashtextextended(${key}, 0)) AS locked`);
      if (rowsOf<{ locked: boolean }>(result)[0]?.locked !== true) return { locked: false as const };
      return { locked: true as const, value: await fn() };
    });
  },

  async countByKind() {
    const waiting = inArray(OutboxJobTable.status, ["pending", "running"]);
    const rows = await db
      .select({
        kind: OutboxJobTable.kind,
        pending: sql<number>`count(*) filter (where ${waiting})`.mapWith(Number),
        quarantined: sql<number>`count(*) filter (where ${OutboxJobTable.status} = 'quarantined')`.mapWith(Number),
        oldestPendingAt: sql<Date | null>`min(${OutboxJobTable.created_at}) filter (where ${waiting})`.mapWith((value) =>
          value === null || value === undefined ? null : new Date(value as string),
        ),
      })
      .from(OutboxJobTable)
      .where(inArray(OutboxJobTable.status, ["pending", "running", "quarantined"]))
      .groupBy(OutboxJobTable.kind);
    return rows;
  },

  async reprocess(filter, now) {
    const conditions = [eq(OutboxJobTable.status, "quarantined")];
    if (filter.kinds && filter.kinds.length > 0) conditions.push(inArray(OutboxJobTable.kind, [...filter.kinds]));
    if (filter.ids && filter.ids.length > 0) conditions.push(inArray(OutboxJobTable.id, [...filter.ids]));
    const rows = await db
      .update(OutboxJobTable)
      .set({ status: "pending", attempts: 0, next_attempt_at: now, quarantined_at: null, lease_until: null, updated_at: now })
      .where(and(...conditions))
      .returning({ id: OutboxJobTable.id });
    return rows.length;
  },
};
