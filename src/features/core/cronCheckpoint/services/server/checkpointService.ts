// src/features/core/cronCheckpoint/services/server/checkpointService.ts
// cron チェックポイントの読み書き。
//
// - getCheckpoint: 未登録なら fallback を返す（DB には書かない）
// - advanceCheckpoint: 単調前進（DB 側の GREATEST で保証。並走・古い値の再送でも後退しない）
// - resetCheckpoint: 無条件上書き。遡及再計算などの運用操作専用
//
// Date を sql テンプレートに直接埋めないこと（drizzle の insert/values 経由か ISO 文字列にする）。

import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/drizzle";
import { runWithTransaction, type TransactionClient } from "@/lib/drizzle/transaction";
import { DomainError } from "@/lib/errors/domainError";

import { CronCheckpointTable } from "@/features/core/cronCheckpoint/entities/drizzle";

const t = CronCheckpointTable;

export type CronCheckpoint = {
  name: string;
  checkpointAt: Date;
  updatedAt: Date;
};

export type AdvanceCheckpointResult = {
  /** 前進後（= DB 上の現在値）。渡した ts より大きければ「既に先へ進んでいた」 */
  checkpointAt: Date;
  /** 渡した ts で実際に前進したか（false = 既存値の方が新しかった） */
  advanced: boolean;
};

function assertName(name: string): void {
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new DomainError("チェックポイント名は空にできません。", { status: 400 });
  }
}

function assertDate(ts: Date, label: string): void {
  if (!(ts instanceof Date) || Number.isNaN(ts.getTime())) {
    throw new DomainError(`${label} は有効な Date で指定してください。`, { status: 400 });
  }
}

/**
 * チェックポイントを取得する。未登録なら fallback を返す（登録はしない）。
 *
 * fallback の目安:
 * - 差分走査の初回に全件を対象にしたい → `new Date(0)`（予算付きランナーで自然にバックフィルされる）
 * - 導入前の履歴を捨ててよい → `new Date()`（導入時点以降のみ対象）
 */
export async function getCheckpoint(
  name: string,
  fallback: Date,
  tx?: TransactionClient,
): Promise<Date> {
  assertName(name);
  assertDate(fallback, "fallback");
  const client = tx ?? db;
  const rows = await client
    .select({ checkpointAt: t.checkpointAt })
    .from(t)
    .where(eq(t.name, name))
    .limit(1);
  return rows[0]?.checkpointAt ?? fallback;
}

/** 登録済みかどうかに関わらず生の行を返す（運用確認用） */
export async function findCheckpoint(name: string): Promise<CronCheckpoint | null> {
  assertName(name);
  const rows = await db.select().from(t).where(eq(t.name, name)).limit(1);
  return rows[0] ?? null;
}

/** 登録済みチェックポイント一覧（名前順） */
export async function listCheckpoints(): Promise<CronCheckpoint[]> {
  return db.select().from(t).orderBy(t.name);
}

/**
 * チェックポイントを ts まで前進させる（単調）。
 *
 * `INSERT ... ON CONFLICT DO UPDATE SET checkpoint_at = GREATEST(現在値, 新値)` の 1 文で
 * 行うため、並走した cron や古い値の再送があっても後退しない。
 * 進捗の永続化点（runBudgetedBatches の onChunkDone 等）から呼ぶ。
 */
export async function advanceCheckpoint(
  name: string,
  ts: Date,
  tx?: TransactionClient,
): Promise<AdvanceCheckpointResult> {
  assertName(name);
  assertDate(ts, "ts");
  return runWithTransaction(tx, async (client) => {
    const rows = await client
      .insert(t)
      .values({ name, checkpointAt: ts })
      .onConflictDoUpdate({
        target: t.name,
        set: {
          checkpointAt: sql`GREATEST(${t.checkpointAt}, EXCLUDED.checkpoint_at)`,
          updatedAt: sql`now()`,
        },
      })
      .returning({ checkpointAt: t.checkpointAt });
    const checkpointAt = rows[0]!.checkpointAt;
    return { checkpointAt, advanced: checkpointAt.getTime() === ts.getTime() };
  });
}

/**
 * チェックポイントを無条件に ts へ上書きする（後退可）。
 *
 * 用途は運用操作のみ: ソースデータの遡及修正後に差分走査を巻き戻して再処理させる等。
 * 通常の cron 経路からは呼ばないこと（単調性が崩れる）。
 */
export async function resetCheckpoint(
  name: string,
  ts: Date,
  tx?: TransactionClient,
): Promise<void> {
  assertName(name);
  assertDate(ts, "ts");
  await runWithTransaction(tx, async (client) => {
    await client
      .insert(t)
      .values({ name, checkpointAt: ts })
      .onConflictDoUpdate({
        target: t.name,
        set: { checkpointAt: ts, updatedAt: sql`now()` },
      });
  });
}

/** チェックポイント行を削除する（次回 getCheckpoint は fallback に戻る） */
export async function deleteCheckpoint(name: string, tx?: TransactionClient): Promise<boolean> {
  assertName(name);
  return runWithTransaction(tx, async (client) => {
    const rows = await client.delete(t).where(eq(t.name, name)).returning({ name: t.name });
    return rows.length > 0;
  });
}
