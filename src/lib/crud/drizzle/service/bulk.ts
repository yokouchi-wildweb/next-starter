// src/lib/crud/drizzle/service/bulk.ts
// 一括の群: bulkDeleteBy* / bulkUpdateBy* / systemBulkUpdateByQuery / bulkHardDeleteByIds / 多対多の一括の追加・削除

import { db } from "@/lib/drizzle";
import { omitUndefined } from "../../utils/object";
import { inArray } from "drizzle-orm";
import { DomainError } from "@/lib/errors";
import type { PgTable, AnyPgColumn, PgUpdateSetSource } from "drizzle-orm/pg-core";
import type { BulkRelationResult, WhereExpr } from "../../types";
import { buildWhere } from "../query";
import { coerceEmptyArraysToNull } from "../utils";
import type { DbTransaction, DbExecutor } from "../types";
import { separateBelongsToManyInput, bulkSyncBelongsToManyRelations } from "../belongsToMany";
import type { ServiceContext } from "./context";
import { handleConstraintError, withCrudEnhancements } from "./errors";

export function createBulkMethods<TTable extends PgTable & { id: AnyPgColumn }, TCreate extends Record<string, any>>(ctx: ServiceContext<TTable, TCreate>) {
  type Insert = TCreate;
  const { table, serviceOptions, audit, auditBulkMode, projectAuditFields, auditIdOf, auditOnUpdate, auditOnDelete, auditOnBulkAggregate, fetchAuditBeforeSnapshots, idColumn, belongsToManyRelations, performBulkRelationChange, prepareSystemWriteData, maskSqlValues, performBulkUpdateByQuery, deletedAtColumn } = ctx;
  return {
    async bulkDeleteByIds(ids: string[], tx?: DbTransaction): Promise<void> {
      const isHard = !deletedAtColumn;

      const performBulk = async (executor: DbExecutor): Promise<void> => {
        // detail モード: 各レコードの before を取得してから削除
        let beforeSnapshots: Map<string, Record<string, unknown>> | undefined;
        if (audit && auditBulkMode === "detail") {
          beforeSnapshots = await fetchAuditBeforeSnapshots(executor, ids);
        }

        if (deletedAtColumn) {
          await executor
            .update(table)
            .set({ deletedAt: new Date() } as PgUpdateSetSource<TTable>)
            .where(inArray(idColumn, ids));
        } else {
          try {
            await executor.delete(table).where(inArray(idColumn, ids));
          } catch (error) {
            handleConstraintError(error);
          }
        }

        // audit
        if (audit && auditBulkMode === "aggregate") {
          await auditOnBulkAggregate(
            executor,
            isHard ? "hard_deleted" : "deleted",
            { count: ids.length, sampleIds: ids.slice(0, 10) },
          );
        } else if (audit && auditBulkMode === "detail" && beforeSnapshots) {
          for (const before of beforeSnapshots.values()) {
            await auditOnDelete(executor, before, { hard: isHard });
          }
        }
      };

      if (audit && audit.bulkMode !== "off" && !tx) {
        await db.transaction(async (innerTx) => performBulk(innerTx));
      } else {
        await performBulk(tx ?? db);
      }
    },
    async bulkUpdateByIds(
      ids: string[],
      data: Partial<Insert>,
      tx?: DbTransaction,
    ): Promise<{ count: number }> {
      if (ids.length === 0) {
        return { count: 0 };
      }

      const parsed = serviceOptions.parseUpdate
        ? await serviceOptions.parseUpdate(data)
        : data;
      const { sanitizedData, relationValues } = separateBelongsToManyInput(parsed, belongsToManyRelations);
      const updateData = coerceEmptyArraysToNull(table, omitUndefined({
        ...sanitizedData,
        ...(serviceOptions.useUpdatedAt && { updatedAt: new Date() }),
      })) as PgUpdateSetSource<TTable>;

      const hasColumnUpdates = Object.keys(updateData).length > 0;
      const shouldSyncRelations = belongsToManyRelations.length > 0 && relationValues.size > 0;

      // リレーション同期が不要な場合: 1クエリで完了
      if (!shouldSyncRelations) {
        const performSimpleUpdate = async (executor: DbExecutor): Promise<{ count: number }> => {
          if (!hasColumnUpdates) return { count: 0 };

          // detail モード: before を先に取得
          let beforeSnapshots: Map<string, Record<string, unknown>> | undefined;
          if (audit && auditBulkMode === "detail") {
            beforeSnapshots = await fetchAuditBeforeSnapshots(executor, ids);
          }

          await executor
            .update(table)
            .set(updateData)
            .where(inArray(idColumn, ids));

          if (audit && auditBulkMode === "aggregate") {
            await auditOnBulkAggregate(
              executor,
              "updated",
              { count: ids.length, sampleIds: ids.slice(0, 10), patch: projectAuditFields(updateData as Record<string, unknown>) },
            );
          } else if (audit && auditBulkMode === "detail" && beforeSnapshots) {
            const afterSnapshots = await fetchAuditBeforeSnapshots(executor, ids);
            for (const [id, before] of beforeSnapshots) {
              const after = afterSnapshots.get(id);
              if (after) await auditOnUpdate(executor, before, after);
            }
          }
          return { count: ids.length };
        };

        if (audit && audit.bulkMode !== "off" && !tx) {
          return db.transaction(async (innerTx) => performSimpleUpdate(innerTx));
        }
        return performSimpleUpdate(tx ?? db);
      }

      // リレーション同期が必要な場合: カラム更新は1クエリ、リレーション同期は各IDごと
      const performUpdate = async (executor: DbTransaction | typeof db): Promise<{ count: number }> => {
        // detail モード: 各レコードの before を更新前に取得
        let beforeSnapshots: Map<string, Record<string, unknown>> | undefined;
        if (audit && auditBulkMode === "detail") {
          beforeSnapshots = await fetchAuditBeforeSnapshots(executor, ids);
        }

        if (hasColumnUpdates) {
          await executor
            .update(table)
            .set(updateData)
            .where(inArray(idColumn, ids));
        }
        await bulkSyncBelongsToManyRelations(
          executor as DbTransaction,
          belongsToManyRelations,
          ids,
          relationValues,
        );

        // audit
        if (audit && auditBulkMode === "aggregate") {
          await auditOnBulkAggregate(
            executor,
            "updated",
            { count: ids.length, sampleIds: ids.slice(0, 10), patch: projectAuditFields(updateData as Record<string, unknown>) },
          );
        } else if (audit && auditBulkMode === "detail" && beforeSnapshots) {
          const afterSnapshots = await fetchAuditBeforeSnapshots(executor, ids);
          for (const [id, before] of beforeSnapshots) {
            const after = afterSnapshots.get(id);
            if (after) await auditOnUpdate(executor, before, after);
          }
        }
        return { count: ids.length };
      };

      if (tx) {
        return performUpdate(tx);
      }
      return db.transaction(async (innerTx) => performUpdate(innerTx));
    },
    /**
     * 複数レコードに同じ関連先を足す（belongsToMany）。既存の関連は残り、再追加は何もしない。
     * 存在しない id（論理削除済みを含む）は飛ばして結果で返す。
     */
    async bulkAddRelation(
      fieldName: string,
      ids: string[],
      targetIds: string[],
      tx?: DbTransaction,
    ): Promise<BulkRelationResult> {
      return performBulkRelationChange("added", fieldName, ids, targetIds, tx);
    },
    /** 複数レコードから指定の関連先だけを外す（belongsToMany）。他の関連は残す */
    async bulkRemoveRelation(
      fieldName: string,
      ids: string[],
      targetIds: string[],
      tx?: DbTransaction,
    ): Promise<BulkRelationResult> {
      return performBulkRelationChange("removed", fieldName, ids, targetIds, tx);
    },
    async bulkDeleteByQuery(where: WhereExpr, tx?: DbTransaction): Promise<void> {
      if (!where) {
        throw new Error("bulkDeleteByQuery requires a where condition.");
      }
      const condition = buildWhere(table, where);
      const isHard = !deletedAtColumn;

      const performBulk = async (executor: DbExecutor): Promise<void> => {
        // 影響対象の ID 群を audit のために事前取得（aggregate なら count のみ、detail なら全レコード）
        let affectedIds: string[] = [];
        let beforeSnapshots: Map<string, Record<string, unknown>> | undefined;

        if (audit && auditBulkMode !== "off") {
          if (auditBulkMode === "detail") {
            const rows = (await executor.select().from(table as any).where(condition)) as Record<
              string,
              unknown
            >[];
            beforeSnapshots = new Map();
            for (const row of rows) {
              const id = auditIdOf(row);
              affectedIds.push(id);
              beforeSnapshots.set(id, row);
            }
          } else {
            const rows = (await executor.select({ id: idColumn }).from(table as any).where(condition)) as { id: unknown }[];
            affectedIds = rows.map((r) => String(r.id));
          }
        }

        if (deletedAtColumn) {
          await executor
            .update(table)
            .set({ deletedAt: new Date() } as PgUpdateSetSource<TTable>)
            .where(condition);
        } else {
          try {
            await executor.delete(table).where(condition);
          } catch (error) {
            handleConstraintError(error);
          }
        }

        if (audit && auditBulkMode === "aggregate") {
          await auditOnBulkAggregate(
            executor,
            isHard ? "hard_deleted" : "deleted",
            { count: affectedIds.length, sampleIds: affectedIds.slice(0, 10), criteria: where as unknown as Record<string, unknown> },
          );
        } else if (audit && auditBulkMode === "detail" && beforeSnapshots) {
          for (const before of beforeSnapshots.values()) {
            await auditOnDelete(executor, before, { hard: isHard });
          }
        }
      };

      if (audit && audit.bulkMode !== "off" && !tx) {
        await db.transaction(async (innerTx) => performBulk(innerTx));
      } else {
        await performBulk(tx ?? db);
      }
    },
    /**
     * WhereExpr 条件に一致する行の一括更新（bulkDeleteByQuery の update 版）。
     * data は bulkUpdateByIds と同じ parseUpdate 経路を通る（Zod strip 適用）。
     * belongsToMany フィールドは対象外（対象 ID が事前確定しないため throw）。
     * 実際に更新された件数を { count } で返す。
     */
    async bulkUpdateByQuery(
      where: WhereExpr,
      data: Partial<Insert>,
      tx?: DbTransaction,
    ): Promise<{ count: number }> {
      const parsed = serviceOptions.parseUpdate
        ? await serviceOptions.parseUpdate(data)
        : data;
      const { sanitizedData, relationValues } = separateBelongsToManyInput(parsed, belongsToManyRelations);
      if (relationValues.size > 0) {
        throw new DomainError(
          "bulkUpdateByQuery() does not support belongsToMany fields. Use bulkUpdateByIds() instead.",
          { status: 500 },
        );
      }
      const updateData = coerceEmptyArraysToNull(table, omitUndefined({
        ...sanitizedData,
        ...(serviceOptions.useUpdatedAt && { updatedAt: new Date() }),
      })) as Record<string, unknown>;

      if (Object.keys(updateData).length === 0) {
        return { count: 0 };
      }
      return withCrudEnhancements(() =>
        performBulkUpdateByQuery(
          "bulkUpdateByQuery",
          where,
          updateData,
          projectAuditFields(updateData),
          tx,
        ),
      );
    },
    /**
     * WhereExpr 条件に一致する行の特権一括更新（systemUpdate の bulk 版）。
     * data は systemColumns 宣言済みカラムのみ許可（parseUpdate バイパス・fail-closed）。
     * 値には drizzle の SQL 式を渡せる。サービス層限定・汎用 HTTP ルートには配線しないこと。
     */
    async systemBulkUpdateByQuery(
      where: WhereExpr,
      data: Record<string, unknown>,
      tx?: DbTransaction,
    ): Promise<{ count: number }> {
      const updateData = prepareSystemWriteData(data, "systemBulkUpdateByQuery");
      return withCrudEnhancements(() =>
        performBulkUpdateByQuery(
          "systemBulkUpdateByQuery",
          where,
          updateData,
          projectAuditFields(maskSqlValues(updateData)),
          tx,
        ),
      );
    },
    async bulkHardDeleteByIds(ids: string[], tx?: DbTransaction): Promise<void> {
      const performBulk = async (executor: DbExecutor): Promise<void> => {
        let beforeSnapshots: Map<string, Record<string, unknown>> | undefined;
        if (audit && auditBulkMode === "detail") {
          beforeSnapshots = await fetchAuditBeforeSnapshots(executor, ids);
        }
        try {
          await executor.delete(table).where(inArray(idColumn, ids));
        } catch (error) {
          handleConstraintError(error);
        }
        if (audit && auditBulkMode === "aggregate") {
          await auditOnBulkAggregate(
            executor,
            "hard_deleted",
            { count: ids.length, sampleIds: ids.slice(0, 10) },
          );
        } else if (audit && auditBulkMode === "detail" && beforeSnapshots) {
          for (const before of beforeSnapshots.values()) {
            await auditOnDelete(executor, before, { hard: true });
          }
        }
      };

      if (audit && audit.bulkMode !== "off" && !tx) {
        await db.transaction(async (innerTx) => performBulk(innerTx));
      } else {
        await performBulk(tx ?? db);
      }
    },
  };
}
