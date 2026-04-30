// src/features/core/auditLog/services/server/auditLogService.ts

import { db } from "@/lib/drizzle";
import {
  computeAuditDiff,
  getAuditContext,
  stripDenylisted,
  truncateLargeValues,
  validateActionName,
  validateTargetId,
  type AuditContext,
  type AuditRecordInput,
} from "@/lib/audit";
import type { DbTransaction } from "@/lib/crud/drizzle";

import { AuditLogTable, AuditLogFailedTable } from "@/features/core/auditLog/entities/drizzle";
import {
  AUDIT_MODE_DISABLED,
  DEFAULT_RETENTION_DAYS,
} from "@/features/core/auditLog/constants";

/**
 * record() の追加オプション。基本入力は AuditRecordInput を踏襲。
 *
 * - tx: 同一トランザクションに含めたい場合に明示的に渡す
 * - defaultRetentionDays: ドメイン側で別の保持期間をデフォルト化したい場合に上書き
 */
type RecordOptions = AuditRecordInput & {
  tx?: DbTransaction;
  defaultRetentionDays?: number;
};

/**
 * recordDiff() の入力。trackedFields を絞れば差分検出対象を限定できる。
 * skipIfNoChanges 既定 true（変更なし → 記録スキップ）
 */
type RecordDiffOptions = Omit<RecordOptions, "before" | "after"> & {
  before: Record<string, unknown> | null | undefined;
  after: Record<string, unknown> | null | undefined;
  trackedFields?: readonly string[];
  skipIfNoChanges?: boolean;
};

/**
 * 同一リクエスト内で複数の audit が記録される場合に context を 1 度だけ解決する。
 * 明示的な context 上書きを優先し、無ければ ALS から取得する。
 */
function resolveContext(explicit?: AuditContext): AuditContext {
  if (explicit) return explicit;
  const ctx = getAuditContext();
  if (!ctx) {
    throw new Error(
      "[audit] AuditContext is not set. Wrap server-side entry points with runWithAuditContext or pass `context` explicitly.",
    );
  }
  return ctx;
}

/**
 * 記録ペイロードの整形。
 * - validation（action / targetId）
 * - denylist 除外
 * - サイズ過大値の切り詰め
 * - context の jsonb 化
 */
function buildPayload(input: RecordOptions, context: AuditContext) {
  validateActionName(input.action);
  validateTargetId(input.targetId);

  const beforeFiltered = stripDenylisted(input.before ?? null);
  const afterFiltered = stripDenylisted(input.after ?? null);

  return {
    targetType: input.targetType,
    targetId: input.targetId,
    actorId: context.actorId,
    actorType: context.actorType,
    action: input.action,
    beforeValue: truncateLargeValues(beforeFiltered),
    afterValue: truncateLargeValues(afterFiltered),
    context: {
      ip: context.ip,
      userAgent: context.userAgent,
      sessionId: context.sessionId,
      requestId: context.requestId,
    },
    metadata: input.metadata ?? null,
    reason: input.reason ?? null,
    retentionDays: input.retentionDays ?? input.defaultRetentionDays ?? DEFAULT_RETENTION_DAYS,
  };
}

/**
 * dead-letter テーブルへ退避する。
 * 親 tx と独立させるため必ず `db` を使う（tx は使わない）。
 * 退避自体に失敗した場合は console に吐き、recursion を避ける。
 */
async function writeDeadLetter(payload: unknown, error: unknown): Promise<void> {
  try {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack ?? null : null;
    await db.insert(AuditLogFailedTable).values({
      payload: payload as never,
      errorMessage,
      errorStack,
    });
  } catch (deadLetterError) {
    console.error("[audit] dead-letter write failed", { deadLetterError, originalError: error });
  }
}

/**
 * 監査ログ記録の公開 API。
 *
 * 利用方針:
 * - 通常は manual record（このオブジェクトの record / recordDiff）を呼び出す
 * - context は ALS から自動取得されるため、wrapper のシグネチャに actor を伝染させない
 * - default は strict: 失敗時に throw → 呼び出し元の tx ごと rollback
 * - bestEffort: true → 失敗時 dead-letter に退避し、本処理は継続
 *
 * AUDIT_MODE=disabled の場合は全 call が no-op（インシデント対応用の最終手段）。
 */
export const auditLogger = {
  /**
   * 監査ログを 1 件記録する。
   *
   * @param input - 記録対象の情報。before/after は変更フィールドだけに絞ること。
   *   - bestEffort: true で失敗時 dead-letter 退避（既定: false = strict）
   *   - tx: 同一トランザクションで書きたい場合に明示
   */
  async record(input: RecordOptions): Promise<void> {
    if (AUDIT_MODE_DISABLED) return;

    let context: AuditContext;
    try {
      context = resolveContext(input.context);
    } catch (error) {
      // context 解決失敗は基本 throw だが、bestEffort なら dead-letter に流す
      if (input.bestEffort) {
        await writeDeadLetter(input, error);
        return;
      }
      throw error;
    }

    let payload: ReturnType<typeof buildPayload>;
    try {
      payload = buildPayload(input, context);
    } catch (error) {
      if (input.bestEffort) {
        await writeDeadLetter({ ...input, _contextSnapshot: context }, error);
        return;
      }
      throw error;
    }

    try {
      const executor = input.tx ?? db;
      await executor.insert(AuditLogTable).values(payload);
    } catch (error) {
      if (input.bestEffort) {
        await writeDeadLetter(payload, error);
        return;
      }
      throw error;
    }
  },

  /**
   * before / after から差分を自動計算して記録する。
   *
   * - trackedFields を渡せば対象フィールドを限定できる（推奨）
   * - skipIfNoChanges 既定 true: 差分なし → 記録スキップ（無駄な insert を避ける）
   * - before / after からは denylist 対象を自動除外
   */
  async recordDiff(input: RecordDiffOptions): Promise<void> {
    const { before, after, trackedFields, skipIfNoChanges = true, ...rest } = input;
    const diff = computeAuditDiff(before, after, trackedFields);
    if (!diff.hasChanges && skipIfNoChanges) return;
    await this.record({
      ...rest,
      before: diff.before,
      after: diff.after,
    });
  },
};

export type AuditLogger = typeof auditLogger;
