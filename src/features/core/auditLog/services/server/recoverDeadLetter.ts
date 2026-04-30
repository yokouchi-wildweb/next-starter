// src/features/core/auditLog/services/server/recoverDeadLetter.ts

import { asc, inArray } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import {
  AuditLogTable,
  AuditLogFailedTable,
} from "@/features/core/auditLog/entities/drizzle";

/**
 * 1 回の実行で再投入を試みる行数の既定値。
 * 大量に dead-letter が溜まっている状況でも 1 cron で全件捌こうとせず、
 * 次回実行に持ち越す方針（恒久エラーの暴走再試行を避けるため）。
 */
const DEFAULT_LIMIT = 500;

/**
 * 観測のためにレスポンスへ含めるエラーサンプル件数。
 * 全件を返すとペイロードが膨らむため上限を設ける。
 */
const ERROR_SAMPLE_LIMIT = 5;

export type RecoverOptions = {
  /**
   * 試行件数。既定 500。
   * Note: dead-letter テーブルへの SELECT 自体は軽量だが、
   * 復旧 INSERT は通常書き込みと同等のコストなので過剰に増やさない。
   */
  limit?: number;
  /**
   * true の場合、再 INSERT も DELETE も実行せず、対象件数だけを返す（観測用）。
   */
  dryRun?: boolean;
};

export type RecoverResult = {
  total: number;
  recovered: number;
  failed: number;
  dryRun: boolean;
  errorSamples: Array<{ id: string; error: string }>;
};

/**
 * `audit_logs` の payload として最低限必要なキー。
 * dead-letter に保存される際は AuditLogTable のカラム名そのままで JSON 化されている想定
 * (`auditLogService.writeDeadLetter` の挙動)。
 */
type AuditLogInsertPayload = {
  targetType: string;
  targetId: string;
  actorId: string | null;
  actorType: string;
  action: string;
  beforeValue: unknown;
  afterValue: unknown;
  context: unknown;
  metadata: unknown;
  reason: string | null;
  retentionDays: number;
};

/**
 * payload が AuditLogTable に再投入できる形を満たすかを軽くチェックする。
 *
 * - context 解決失敗時の dead-letter には raw `RecordOptions` が入っている可能性がある
 *   (auditLogService.record の context 解決失敗パス参照)
 * - 形が合わないものは早期に failed としてカウントし、再投入を試みない（無限再試行防止）
 */
function isAuditLogPayload(value: unknown): value is AuditLogInsertPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.targetType === "string" &&
    typeof v.targetId === "string" &&
    typeof v.actorType === "string" &&
    typeof v.action === "string" &&
    typeof v.retentionDays === "number"
  );
}

/**
 * `audit_logs_failed` に退避された行の再投入を試みる。
 *
 * - 成功した行は `audit_logs_failed` から削除、`audit_logs` へ移動
 * - 失敗した行はそのまま `audit_logs_failed` に残す（次回実行で再試行される）
 *
 * @returns 試行件数 / 成功件数 / 失敗件数 と先頭 N 件のエラー例
 */
export async function recoverDeadLetterAuditLogs(
  options: RecoverOptions = {},
): Promise<RecoverResult> {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const dryRun = options.dryRun ?? false;

  const candidates = await db
    .select({
      id: AuditLogFailedTable.id,
      payload: AuditLogFailedTable.payload,
    })
    .from(AuditLogFailedTable)
    .orderBy(asc(AuditLogFailedTable.createdAt))
    .limit(limit);

  if (candidates.length === 0) {
    return { total: 0, recovered: 0, failed: 0, dryRun, errorSamples: [] };
  }

  if (dryRun) {
    return {
      total: candidates.length,
      recovered: 0,
      failed: 0,
      dryRun,
      errorSamples: [],
    };
  }

  const recoveredIds: string[] = [];
  let failed = 0;
  const errorSamples: RecoverResult["errorSamples"] = [];

  for (const row of candidates) {
    const { id, payload } = row;
    if (!isAuditLogPayload(payload)) {
      failed += 1;
      if (errorSamples.length < ERROR_SAMPLE_LIMIT) {
        errorSamples.push({
          id,
          error: "payload shape is not compatible with audit_logs schema",
        });
      }
      continue;
    }

    try {
      await db.insert(AuditLogTable).values({
        targetType: payload.targetType,
        targetId: payload.targetId,
        actorId: payload.actorId ?? null,
        actorType: payload.actorType as never,
        action: payload.action,
        beforeValue: (payload.beforeValue as never) ?? null,
        afterValue: (payload.afterValue as never) ?? null,
        context: (payload.context as never) ?? null,
        metadata: (payload.metadata as never) ?? null,
        reason: payload.reason ?? null,
        retentionDays: payload.retentionDays,
      });
      recoveredIds.push(id);
    } catch (error) {
      failed += 1;
      if (errorSamples.length < ERROR_SAMPLE_LIMIT) {
        errorSamples.push({
          id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  if (recoveredIds.length > 0) {
    // 復旧成功分は dead-letter から削除（再試行ループ防止）。
    // ここで失敗しても再投入は完了済みなので呼び出し元には成功扱いで返す。
    try {
      await db
        .delete(AuditLogFailedTable)
        .where(inArray(AuditLogFailedTable.id, recoveredIds));
    } catch (error) {
      console.error(
        "[audit] dead-letter cleanup failed (rows already replayed into audit_logs)",
        { error, recoveredIds },
      );
    }
  }

  return {
    total: candidates.length,
    recovered: recoveredIds.length,
    failed,
    dryRun,
    errorSamples,
  };
}
