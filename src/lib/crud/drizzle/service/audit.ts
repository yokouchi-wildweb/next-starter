// src/lib/crud/drizzle/service/audit.ts
// 監査ログ(serviceOptions.audit)の記録の道具。createServiceContext が 1 度作り、群が使う

import { db } from "@/lib/drizzle";
import { stripDenylisted } from "@/lib/audit";
import { inArray } from "drizzle-orm";
import type { PgTable, AnyPgColumn } from "drizzle-orm/pg-core";
import type { AuditConfig, BulkAuditMode, CrudServiceOptions, DbExecutor } from "../types";

export function createAuditHooks<TTable extends PgTable & { id: AnyPgColumn }, TCreate extends Record<string, any>>(
  table: TTable,
  idColumn: TTable["id"],
  serviceOptions: CrudServiceOptions<TCreate>,
) {
  // ===== 監査ログ（audit）統合 =====
  // serviceOptions.audit が指定された場合、CRUD 操作を audit_logs に自動記録する。
  // recorder は domains/core/auditLog 側から DI される（lib→features 違反回避）。
  const audit: AuditConfig | undefined =
    serviceOptions.audit?.enabled ? serviceOptions.audit : undefined;
  const auditBulkMode: BulkAuditMode = audit?.bulkMode ?? "aggregate";
  const auditStrict = audit?.strict !== false; // 既定 true
  const auditBestEffort = !auditStrict;

  /** 記録対象フィールドのみを抽出（trackedFields 指定時）+ denylist 除外 */
  const projectAuditFields = (
    record: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> | null => {
    if (!record) return null;
    if (audit?.trackedFields?.length) {
      const result: Record<string, unknown> = {};
      for (const field of audit.trackedFields) {
        if (field in record) result[field] = (record as Record<string, unknown>)[field];
      }
      return stripDenylisted(result);
    }
    return stripDenylisted(record as Record<string, unknown>);
  };

  /** record の id を文字列化。number / uuid / string を許容 */
  const auditIdOf = (record: Record<string, unknown>): string => {
    const value = record.id;
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
    return String(value);
  };

  /** executor が tx 経由なら recorder.tx として渡す。db 直なら undefined */
  const auditTxOf = (executor: DbExecutor): unknown => (executor === db ? undefined : executor);

  const auditCommonOptions = () =>
    audit
      ? {
          retentionDays: audit.retentionDays,
          bestEffort: auditBestEffort,
        }
      : null;

  /** create 系操作の audit 記録 */
  const auditOnCreate = async (executor: DbExecutor, created: Record<string, unknown>) => {
    if (!audit) return;
    await audit.recorder.record({
      ...auditCommonOptions()!,
      targetType: audit.targetType,
      targetId: auditIdOf(created),
      action: `${audit.actionPrefix}.created`,
      after: projectAuditFields(created),
      tx: auditTxOf(executor),
    });
  };

  /** update 系操作の audit 記録（差分があれば） */
  const auditOnUpdate = async (
    executor: DbExecutor,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ) => {
    if (!audit) return;
    await audit.recorder.recordDiff({
      ...auditCommonOptions()!,
      targetType: audit.targetType,
      targetId: auditIdOf(after),
      action: `${audit.actionPrefix}.updated`,
      before,
      after,
      trackedFields: audit.trackedFields,
      tx: auditTxOf(executor),
    });
  };

  /** delete 系操作の audit 記録（softDelete / hardDelete 共通） */
  const auditOnDelete = async (
    executor: DbExecutor,
    before: Record<string, unknown>,
    options?: { hard?: boolean },
  ) => {
    if (!audit) return;
    const verb = options?.hard ? "hard_deleted" : "deleted";
    await audit.recorder.record({
      ...auditCommonOptions()!,
      targetType: audit.targetType,
      targetId: auditIdOf(before),
      action: `${audit.actionPrefix}.${verb}`,
      before: projectAuditFields(before),
      tx: auditTxOf(executor),
    });
  };

  /** restore 操作の audit 記録 */
  const auditOnRestore = async (executor: DbExecutor, restored: Record<string, unknown>) => {
    if (!audit) return;
    await audit.recorder.record({
      ...auditCommonOptions()!,
      targetType: audit.targetType,
      targetId: auditIdOf(restored),
      action: `${audit.actionPrefix}.restored`,
      after: projectAuditFields(restored),
      tx: auditTxOf(executor),
    });
  };

  /** bulk 操作の集約モード記録（1 件にまとめる） */
  const auditOnBulkAggregate = async (
    executor: DbExecutor,
    verb: string,
    metadata: Record<string, unknown>,
    representativeTargetId: string = "*",
  ) => {
    if (!audit || auditBulkMode !== "aggregate") return;
    await audit.recorder.record({
      ...auditCommonOptions()!,
      targetType: audit.targetType,
      targetId: representativeTargetId,
      action: `${audit.actionPrefix}.bulk_${verb}`,
      metadata,
      tx: auditTxOf(executor),
    });
  };

  /**
   * detail モード用: 既存レコードを丸ごと取得する（bulk 削除前の before スナップショットなど）。
   * tracking 対象が明示されていれば必要列だけを select して I/O を抑える。
   */
  const fetchAuditBeforeSnapshots = async (
    executor: DbExecutor,
    ids: string[],
  ): Promise<Map<string, Record<string, unknown>>> => {
    if (!ids.length) return new Map();
    const rows = (await executor.select().from(table as any).where(inArray(idColumn, ids))) as Record<
      string,
      unknown
    >[];
    const map = new Map<string, Record<string, unknown>>();
    for (const row of rows) {
      map.set(auditIdOf(row), row);
    }
    return map;
  };

  return {
    audit,
    auditBulkMode,
    auditStrict,
    auditBestEffort,
    projectAuditFields,
    auditIdOf,
    auditTxOf,
    auditCommonOptions,
    auditOnCreate,
    auditOnUpdate,
    auditOnDelete,
    auditOnRestore,
    auditOnBulkAggregate,
    fetchAuditBeforeSnapshots,
  };
}
