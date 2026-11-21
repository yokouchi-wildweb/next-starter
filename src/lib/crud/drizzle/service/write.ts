// src/lib/crud/drizzle/service/write.ts
// 1 件の書き込みの群: create / update / systemUpdate / delete / restore / hardDelete

import { db } from "@/lib/drizzle";
import { omitUndefined } from "../../utils/object";
import { eq } from "drizzle-orm";
import { generateFirstSortKey } from "../fractionalSort";
import type { InferSelectModel } from "drizzle-orm";
import type { PgTable, AnyPgColumn, PgUpdateSetSource } from "drizzle-orm/pg-core";
import { applyInsertDefaults, coerceEmptyArraysToNull } from "../utils";
import type { DbTransaction, DbExecutor } from "../types";
import { assignLocalRelationValues, hydrateBelongsToManyRelations, separateBelongsToManyInput, syncBelongsToManyRelations } from "../belongsToMany";
import { sortKeyAsc } from "../fractionalSort/sortKeyOrder";
import type { ServiceContext } from "./context";
import { handleConstraintError, withCrudEnhancements } from "./errors";
import { resolveRecordId } from "./helpers";

export function createWriteMethods<TTable extends PgTable & { id: AnyPgColumn }, TCreate extends Record<string, any>>(ctx: ServiceContext<TTable, TCreate>) {
  type Select = InferSelectModel<TTable>;
  type Insert = TCreate;
  const { table, serviceOptions, audit, auditOnCreate, auditOnUpdate, auditOnDelete, auditOnRestore, idColumn, belongsToManyRelations, prepareSystemWriteData, sortOrderColumn, deletedAtColumn } = ctx;
  return {
    async create(data: Insert, tx?: DbTransaction): Promise<Select> {
      return withCrudEnhancements(async () => {
        const parsedInput = serviceOptions.parseCreate
          ? await serviceOptions.parseCreate(data)
          : data;
        const { sanitizedData, relationValues } = separateBelongsToManyInput(
          parsedInput,
          belongsToManyRelations,
        );
        let finalInsert = coerceEmptyArraysToNull(table, applyInsertDefaults(sanitizedData as Insert, serviceOptions)) as Insert;

        // sortOrderColumn が設定されている場合、sort_order を自動生成（先頭に追加）
        if (sortOrderColumn) {
          const sortOrderFieldName = (sortOrderColumn as any).name as string;
          if ((finalInsert as Record<string, any>)[sortOrderFieldName] === undefined) {
            const executor = tx ?? db;
            // 現在の最小 sortOrder を取得
            const firstResults = await executor
              .select({ sortOrder: sortOrderColumn })
              .from(table as any)
              .orderBy(sortKeyAsc(sortOrderColumn))
              .limit(1) as { sortOrder: string | null }[];
            const firstSortOrder = firstResults[0]?.sortOrder ?? null;
            (finalInsert as Record<string, any>)[sortOrderFieldName] = generateFirstSortKey(firstSortOrder);
          }
        }

        // belongsToMany がない場合
        if (!belongsToManyRelations.length) {
          // audit ありの場合は tx を確保してから記録
          if (audit && !tx) {
            return db.transaction(async (innerTx) => {
              const rows = await innerTx.insert(table).values(finalInsert).returning();
              const created = rows[0] as Select;
              if (created) await auditOnCreate(innerTx, created as Record<string, unknown>);
              return created;
            });
          }
          const executor = tx ?? db;
          const rows = await executor.insert(table).values(finalInsert).returning();
          const created = rows[0] as Select;
          if (created && audit) await auditOnCreate(executor, created as Record<string, unknown>);
          return created;
        }

        // belongsToMany があり、外部トランザクションが渡された場合
        if (tx) {
          const rows = await tx.insert(table).values(finalInsert).returning();
          const created = rows[0] as Select;
          if (!created) return created;
          const relationRecordId = resolveRecordId(created.id as unknown);
          if (relationRecordId !== undefined) {
            await syncBelongsToManyRelations(tx, belongsToManyRelations, relationRecordId, relationValues);
          }
          assignLocalRelationValues(created, belongsToManyRelations, relationValues);
          if (audit) await auditOnCreate(tx, created as Record<string, unknown>);
          return created;
        }

        // belongsToMany があり、外部トランザクションがない場合は内部トランザクション
        return db.transaction(async (innerTx) => {
          const rows = await innerTx.insert(table).values(finalInsert).returning();
          const created = rows[0] as Select;
          if (!created) return created;
          const relationRecordId = resolveRecordId(created.id as unknown);
          if (relationRecordId !== undefined) {
            await syncBelongsToManyRelations(innerTx, belongsToManyRelations, relationRecordId, relationValues);
          }
          assignLocalRelationValues(created, belongsToManyRelations, relationValues);
          if (audit) await auditOnCreate(innerTx, created as Record<string, unknown>);
          return created;
        });
      });
    },
    async update(id: string, data: Partial<Insert>, tx?: DbTransaction): Promise<Select> {
      return withCrudEnhancements(async () => {
        const parsed = serviceOptions.parseUpdate
          ? await serviceOptions.parseUpdate(data)
          : data;
        const { sanitizedData, relationValues } = separateBelongsToManyInput(parsed, belongsToManyRelations);
        const updateData = coerceEmptyArraysToNull(table, {
          ...omitUndefined(sanitizedData as Record<string, any>),
        }) as Partial<Insert> & Record<string, any> & { updatedAt?: Date };

        if (serviceOptions.useUpdatedAt && updateData.updatedAt === undefined) {
          updateData.updatedAt = new Date();
        }

        const shouldSyncRelations = belongsToManyRelations.length > 0 && relationValues.size > 0;
        const hasColumnUpdates = Object.keys(updateData).length > 0;

        // 同一 tx 内で before スナップショットを取得するヘルパー（audit 用）
        const fetchBefore = async (executor: DbExecutor): Promise<Select | undefined> => {
          if (!audit) return undefined;
          const rows = await executor.select().from(table as any).where(eq(idColumn, id));
          return rows[0] as Select | undefined;
        };

        // カラム更新またはリレーション同期のいずれかを実行するヘルパー
        const updateOrSelect = async (executor: DbTransaction | typeof db): Promise<Select> => {
          if (hasColumnUpdates) {
            const rows = await executor
              .update(table)
              .set(updateData as PgUpdateSetSource<TTable>)
              .where(eq(idColumn, id))
              .returning();
            return rows[0] as Select;
          }
          // belongsToMany のみの場合、既存レコードを取得
          const rows = await executor
            .select()
            .from(table as any)
            .where(eq(idColumn, id));
          return rows[0] as Select;
        };

        // リレーション同期が不要な場合
        if (!shouldSyncRelations) {
          // audit ありなら tx を確保
          if (audit && !tx) {
            return db.transaction(async (innerTx) => {
              const before = await fetchBefore(innerTx);
              const updated = await updateOrSelect(innerTx);
              if (updated && before) {
                await auditOnUpdate(innerTx, before as Record<string, unknown>, updated as Record<string, unknown>);
              }
              return updated;
            });
          }
          const executor = tx ?? db;
          const before = audit ? await fetchBefore(executor) : undefined;
          const updated = await updateOrSelect(executor);
          if (audit && updated && before) {
            await auditOnUpdate(executor, before as Record<string, unknown>, updated as Record<string, unknown>);
          }
          return updated;
        }

        // リレーション同期が必要で、外部トランザクションが渡された場合
        if (tx) {
          const before = audit ? await fetchBefore(tx) : undefined;
          const updated = await updateOrSelect(tx);
          if (!updated) return updated;
          await syncBelongsToManyRelations(tx, belongsToManyRelations, id, relationValues);
          assignLocalRelationValues(updated, belongsToManyRelations, relationValues);
          if (audit && before) {
            await auditOnUpdate(tx, before as Record<string, unknown>, updated as Record<string, unknown>);
          }
          return updated;
        }

        // リレーション同期が必要で、外部トランザクションがない場合は内部トランザクション
        return db.transaction(async (innerTx) => {
          const before = audit ? await fetchBefore(innerTx) : undefined;
          const updated = await updateOrSelect(innerTx);
          if (!updated) return updated;
          await syncBelongsToManyRelations(innerTx, belongsToManyRelations, id, relationValues);
          assignLocalRelationValues(updated, belongsToManyRelations, relationValues);
          if (audit && before) {
            await auditOnUpdate(innerTx, before as Record<string, unknown>, updated as Record<string, unknown>);
          }
          return updated;
        });
      });
    },
    /**
     * システム管理カラムの特権更新（サービス層限定・parseUpdate バイパス）。
     *
     * Create/Update Zod スキーマから除外されたシステム管理カラム（ended_at, sort_order 等）を
     * createCrudService の正規経路で書き込むためのメソッド。書き込めるのはサービスオプション
     * systemColumns に宣言されたカラムのみで、宣言外のキーは throw する（fail-closed）。
     *
     * 値には drizzle の SQL 式を渡せる（例: sql`${Table.playedCount} + 1` でアトミック加算）。
     * updatedAt 付与・audit 記録（before/after 差分）・requestMemo 自動 invalidate は
     * update() と同一挙動。belongsToMany リレーション同期は対象外。
     *
     * 汎用 HTTP ルートには配線しないこと。HTTP 入力の安全網は従来どおり Zod strip であり、
     * このメソッドはサーバー内部ロジック専用の特権経路。
     */
    async systemUpdate(
      id: string,
      data: Record<string, unknown>,
      tx?: DbTransaction,
    ): Promise<Select> {
      return withCrudEnhancements(async () => {
        const updateData = prepareSystemWriteData(data, "systemUpdate");

        const fetchBefore = async (executor: DbExecutor): Promise<Select | undefined> => {
          if (!audit) return undefined;
          const rows = await executor.select().from(table as any).where(eq(idColumn, id));
          return rows[0] as Select | undefined;
        };

        const performUpdate = async (executor: DbExecutor): Promise<Select> => {
          const rows = await executor
            .update(table)
            .set(updateData as PgUpdateSetSource<TTable>)
            .where(eq(idColumn, id))
            .returning();
          return rows[0] as Select;
        };

        if (audit && !tx) {
          return db.transaction(async (innerTx) => {
            const before = await fetchBefore(innerTx);
            const updated = await performUpdate(innerTx);
            if (updated && before) {
              await auditOnUpdate(innerTx, before as Record<string, unknown>, updated as Record<string, unknown>);
            }
            return updated;
          });
        }
        const executor = tx ?? db;
        const before = audit ? await fetchBefore(executor) : undefined;
        const updated = await performUpdate(executor);
        if (audit && updated && before) {
          await auditOnUpdate(executor, before as Record<string, unknown>, updated as Record<string, unknown>);
        }
        return updated;
      });
    },
    async delete(id: string, tx?: DbTransaction): Promise<void> {
      // audit 用に before を同一 tx で取得 → 削除 → audit 記録
      const performRemove = async (executor: DbExecutor): Promise<void> => {
        const before = audit
          ? ((await executor.select().from(table as any).where(eq(idColumn, id)))[0] as Record<string, unknown> | undefined)
          : undefined;

        if (deletedAtColumn) {
          await executor
            .update(table)
            .set({ deletedAt: new Date() } as PgUpdateSetSource<TTable>)
            .where(eq(idColumn, id));
        } else {
          try {
            await executor.delete(table).where(eq(idColumn, id));
          } catch (error) {
            handleConstraintError(error);
          }
        }

        if (audit && before) {
          await auditOnDelete(executor, before, { hard: !deletedAtColumn });
        }
      };

      if (audit && !tx) {
        await db.transaction(async (innerTx) => performRemove(innerTx));
      } else {
        await performRemove(tx ?? db);
      }
    },
    async restore(id: string, tx?: DbTransaction): Promise<Select> {
      if (!deletedAtColumn) {
        throw new Error("restore() is only available when useSoftDelete is enabled.");
      }
      const performRestore = async (executor: DbExecutor): Promise<Select> => {
        const rows = await executor
          .update(table)
          .set({ deletedAt: null } as PgUpdateSetSource<TTable>)
          .where(eq(idColumn, id))
          .returning();
        const record = rows[0] as Select;
        if (!record) {
          throw new Error(`Record not found: ${id}`);
        }
        if (belongsToManyRelations.length) {
          await hydrateBelongsToManyRelations([record], belongsToManyRelations);
        }
        if (audit) await auditOnRestore(executor, record as Record<string, unknown>);
        return record;
      };

      if (audit && !tx) {
        return db.transaction(async (innerTx) => performRestore(innerTx));
      }
      return performRestore(tx ?? db);
    },
    async hardDelete(id: string, tx?: DbTransaction): Promise<void> {
      const performHardDelete = async (executor: DbExecutor): Promise<void> => {
        const before = audit
          ? ((await executor.select().from(table as any).where(eq(idColumn, id)))[0] as Record<string, unknown> | undefined)
          : undefined;
        try {
          await executor.delete(table).where(eq(idColumn, id));
        } catch (error) {
          handleConstraintError(error);
        }
        if (audit && before) await auditOnDelete(executor, before, { hard: true });
      };

      if (audit && !tx) {
        await db.transaction(async (innerTx) => performHardDelete(innerTx));
      } else {
        await performHardDelete(tx ?? db);
      }
    },
  };
}
