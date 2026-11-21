// src/lib/crud/drizzle/service/upsert.ts
// 取り込みの群: upsert / bulkUpsert / replaceByQuery / bulkUpdate

import { db } from "@/lib/drizzle";
import { omitUndefined } from "../../utils/object";
import { inArray, sql } from "drizzle-orm";
import { generateInitialSortKeys } from "../fractionalSort";
import { DomainError } from "@/lib/errors";
import type { InferSelectModel } from "drizzle-orm";
import type { PgTable, AnyPgColumn, PgUpdateSetSource } from "drizzle-orm/pg-core";
import type { UpsertOptions, BulkUpsertOptions, BulkUpsertResult, BulkUpdateRecord, BulkUpdateResult, ReplaceByQueryOptions, WhereExpr } from "../../types";
import { buildWhere } from "../query";
import { applyInsertDefaults, buildColumnToPropertyMap, coerceEmptyArraysToNull, isBulkValueEqual, normalizeRecordKeys, resolveConflictTarget } from "../utils";
import type { DbTransaction, DbExecutor } from "../types";
import { assignLocalRelationValues, separateBelongsToManyInput, syncBelongsToManyRelations, bulkSyncBelongsToManyRelations } from "../belongsToMany";
import type { ServiceContext } from "./context";
import { handleConstraintError, withCrudEnhancements } from "./errors";
import { isSameScopeValue, resolveRecordId } from "./helpers";

export function createUpsertMethods<TTable extends PgTable & { id: AnyPgColumn }, TCreate extends Record<string, any>>(ctx: ServiceContext<TTable, TCreate>) {
  type Select = InferSelectModel<TTable>;
  type Insert = TCreate;
  const { table, serviceOptions, audit, auditBulkMode, projectAuditFields, auditIdOf, auditTxOf, auditCommonOptions, auditOnCreate, auditOnUpdate, auditOnDelete, auditOnBulkAggregate, fetchAuditBeforeSnapshots, idColumn, belongsToManyRelations, sortOrderColumn, deletedAtColumn } = ctx;
  return {
    async upsert(
      data: Insert & { id?: string },
      upsertOptions?: UpsertOptions<Insert>,
      tx?: DbTransaction,
    ): Promise<Select> {
      return withCrudEnhancements(async () => {
        const parsedInput = serviceOptions.parseUpsert
          ? await serviceOptions.parseUpsert(data)
          : serviceOptions.parseCreate
            ? await serviceOptions.parseCreate(data)
            : data;
        const { sanitizedData, relationValues } = separateBelongsToManyInput(
          parsedInput,
          belongsToManyRelations,
        );

        const sanitizedInsert = coerceEmptyArraysToNull(table, applyInsertDefaults(sanitizedData as Insert, serviceOptions)) as Insert & {
          id?: string;
          createdAt?: Date;
          updatedAt?: Date;
        };

        const updateData = {
          ...sanitizedInsert,
        } as PgUpdateSetSource<TTable> & Record<string, any> & { id?: string };
        delete (updateData as Record<string, unknown>).id;

        // upsert 共通: insert + onConflictDoUpdate を 1 ステートメントで実行
        const performUpsert = async (executor: DbExecutor): Promise<Select> => {
          const rows = await executor
            .insert(table)
            .values(sanitizedInsert as any)
            .onConflictDoUpdate({
              target: resolveConflictTarget(table, serviceOptions, upsertOptions),
              set: updateData,
            })
            .returning();
          return rows[0] as Select;
        };

        // belongsToMany がない場合
        if (!belongsToManyRelations.length) {
          if (audit && !tx) {
            return db.transaction(async (innerTx) => {
              const upserted = await performUpsert(innerTx);
              if (upserted) {
                await audit.recorder.record({
                  ...auditCommonOptions()!,
                  targetType: audit.targetType,
                  targetId: auditIdOf(upserted as Record<string, unknown>),
                  action: `${audit.actionPrefix}.upserted`,
                  after: projectAuditFields(upserted as Record<string, unknown>),
                  tx: auditTxOf(innerTx),
                });
              }
              return upserted;
            });
          }
          const executor = tx ?? db;
          const upserted = await performUpsert(executor);
          if (upserted && audit) {
            await audit.recorder.record({
              ...auditCommonOptions()!,
              targetType: audit.targetType,
              targetId: auditIdOf(upserted as Record<string, unknown>),
              action: `${audit.actionPrefix}.upserted`,
              after: projectAuditFields(upserted as Record<string, unknown>),
              tx: auditTxOf(executor),
            });
          }
          return upserted;
        }

        // belongsToMany があり、外部トランザクションが渡された場合
        if (tx) {
          const upserted = await performUpsert(tx);
          if (!upserted) return upserted;
          const relationRecordId = resolveRecordId(upserted.id as unknown);
          if (relationRecordId !== undefined) {
            await syncBelongsToManyRelations(tx, belongsToManyRelations, relationRecordId, relationValues);
          }
          assignLocalRelationValues(upserted, belongsToManyRelations, relationValues);
          if (audit) {
            await audit.recorder.record({
              ...auditCommonOptions()!,
              targetType: audit.targetType,
              targetId: auditIdOf(upserted as Record<string, unknown>),
              action: `${audit.actionPrefix}.upserted`,
              after: projectAuditFields(upserted as Record<string, unknown>),
              tx: auditTxOf(tx),
            });
          }
          return upserted;
        }

        // belongsToMany があり、外部トランザクションがない場合は内部トランザクション
        return db.transaction(async (innerTx) => {
          const upserted = await performUpsert(innerTx);
          if (!upserted) return upserted;
          const relationRecordId = resolveRecordId(upserted.id as unknown);
          if (relationRecordId !== undefined) {
            await syncBelongsToManyRelations(innerTx, belongsToManyRelations, relationRecordId, relationValues);
          }
          assignLocalRelationValues(upserted, belongsToManyRelations, relationValues);
          if (audit) {
            await audit.recorder.record({
              ...auditCommonOptions()!,
              targetType: audit.targetType,
              targetId: auditIdOf(upserted as Record<string, unknown>),
              action: `${audit.actionPrefix}.upserted`,
              after: projectAuditFields(upserted as Record<string, unknown>),
              tx: auditTxOf(innerTx),
            });
          }
          return upserted;
        });
      });
    },
    /**
     * 複数レコードを一括でupsertする。
     * belongsToMany リレーションには対応していない。
     */
    async bulkUpsert(
      records: (Insert & { id?: string })[],
      bulkUpsertOptions?: BulkUpsertOptions<Insert>,
      tx?: DbTransaction,
    ): Promise<BulkUpsertResult<Select>> {
      if (records.length === 0) {
        return { results: [], count: 0 };
      }

      // belongsToMany がある場合は警告（対応していない）
      if (belongsToManyRelations.length > 0) {
        console.warn(
          "bulkUpsert does not support belongsToMany relations. Use upsert() individually for relation sync.",
        );
      }

      return withCrudEnhancements(async () => {
        // 各レコードをパースしてデフォルト値を適用
        const parsedRecords = await Promise.all(
          records.map(async (data) => {
            // キー名を drizzle スキーマのプロパティ名に正規化（snake_case → camelCase など）
            const normalizedData = normalizeRecordKeys(table, data as Record<string, unknown>) as typeof data;

            // parse 前にシステムフィールドを保存（parse で削除される可能性があるため）
            // Zod スキーマに定義されていないフィールドは strip される
            const originalId = normalizedData.id;
            const originalCreatedAt = (normalizedData as any).createdAt;
            const originalUpdatedAt = (normalizedData as any).updatedAt;
            const originalDeletedAt = (normalizedData as any).deletedAt;

            const parsedInput = serviceOptions.parseUpsert
              ? await serviceOptions.parseUpsert(normalizedData)
              : serviceOptions.parseCreate
                ? await serviceOptions.parseCreate(normalizedData)
                : normalizedData;

            // parse 後にシステムフィールドを復元
            const restored = { ...parsedInput } as any;
            if (originalId !== undefined) {
              restored.id = originalId;
            }
            // createdAt/updatedAt/deletedAt は明示的に設定されていた場合のみ復元
            // これにより CSV からインポートした値が applyInsertDefaults で上書きされない
            // 文字列の場合は Date オブジェクトに変換（drizzle が toISOString を呼ぶため）
            if (originalCreatedAt !== undefined) {
              restored.createdAt = typeof originalCreatedAt === "string"
                ? new Date(originalCreatedAt)
                : originalCreatedAt;
            }
            if (originalUpdatedAt !== undefined) {
              restored.updatedAt = typeof originalUpdatedAt === "string"
                ? new Date(originalUpdatedAt)
                : originalUpdatedAt;
            }
            if (originalDeletedAt !== undefined) {
              restored.deletedAt = typeof originalDeletedAt === "string"
                ? new Date(originalDeletedAt)
                : originalDeletedAt;
            }
            return coerceEmptyArraysToNull(table, applyInsertDefaults(restored as Insert, serviceOptions)) as Insert & {
              id?: string;
              createdAt?: Date;
              updatedAt?: Date;
            };
          }),
        );

        // 更新用のデータを構築（idを除外、excludeFromUpdate も除外）
        const firstRecord = parsedRecords[0];
        const excludeSet = new Set(bulkUpsertOptions?.excludeFromUpdate ?? []);
        const updateColumns = Object.keys(firstRecord).filter(
          (key) => key !== "id" && !excludeSet.has(key)
        ) as Array<keyof typeof firstRecord>;
        const updateData = Object.fromEntries(
          updateColumns.map((col) => {
            // テーブル定義からカラム情報を取得し、実際のカラム名（snake_case）を使用
            const column = (table as any)[col];
            const columnName = column?.name ?? String(col);
            return [col, sql.raw(`excluded."${columnName}"`)];
          }),
        ) as PgUpdateSetSource<TTable>;

        const executor = tx ?? db;
        const conflictTarget = resolveConflictTarget(table, serviceOptions, bulkUpsertOptions);

        let rows: Select[];
        if (bulkUpsertOptions?.skipDuplicates) {
          // 重複時はスキップ（更新しない）
          rows = (await executor
            .insert(table)
            .values(parsedRecords as any[])
            .onConflictDoNothing({ target: conflictTarget })
            .returning()) as Select[];
        } else {
          // 重複時は更新
          rows = (await executor
            .insert(table)
            .values(parsedRecords as any[])
            .onConflictDoUpdate({
              target: conflictTarget,
              set: updateData,
            })
            .returning()) as Select[];
        }

        // audit: bulkUpsert は after のみ記録（before は事前 fetch コストが大きいためサポートしない）
        if (audit && auditBulkMode === "aggregate") {
          await auditOnBulkAggregate(
            executor,
            "upserted",
            {
              count: rows.length,
              sampleIds: rows.slice(0, 10).map((r) => auditIdOf(r as Record<string, unknown>)),
            },
          );
        } else if (audit && auditBulkMode === "detail") {
          for (const row of rows) {
            await audit.recorder.record({
              ...auditCommonOptions()!,
              targetType: audit.targetType,
              targetId: auditIdOf(row as Record<string, unknown>),
              action: `${audit.actionPrefix}.upserted`,
              after: projectAuditFields(row as Record<string, unknown>),
              tx: auditTxOf(executor),
            });
          }
        }

        return { results: rows, count: rows.length };
      });
    },
    /**
     * WhereExpr 条件に一致する行の全削除と records の挿入を単一トランザクションで行う
     * （親スコープ配下の子リストの「丸ごと置換」用）。
     *
     * - READ COMMITTED の並行リーダーからは常に旧セットか新セットのどちらかが見え、
     *   「空」の瞬間は観測されない。失敗時は削除ごと巻き戻る。
     * - records は create と同じ parseCreate（Zod）経路を通り、挿入行を入力順で返す。
     *   records が空の場合は削除のみ実行して [] を返す（許可された操作）。
     * - スコープガード（fail-closed）: where の eq 句（and 直下含む。or 分岐内は対象外）を
     *   スコープ制約とみなし、record 側の未指定値は where の値で自動補完、parse 後に
     *   値が食い違う record があれば 422 で全体を拒否する（records がスコープ外へ逃げない）。
     * - 削除フェーズは bulkDeleteByQuery と同じ分岐（soft-delete はソフトマーク、物理削除は
     *   Storage クリーンアップ + 制約エラー変換）。soft-delete テーブルでは旧行が残るため、
     *   同一 id を records で再送すると PK 衝突する点に注意。
     * - belongsToMany フィールドは非対応（throw）。個別に create() でリレーション同期すること。
     * - 親行のロックは取得しない（アトミックコミットで十分。ロックは呼び出し側の責務）。
     */
    async replaceByQuery(
      where: WhereExpr,
      records: Insert[],
      replaceOptions?: ReplaceByQueryOptions,
      tx?: DbTransaction,
    ): Promise<Select[]> {
      if (!where) {
        throw new Error("replaceByQuery requires a where condition.");
      }
      if (replaceOptions?.sortOrderFromIndex && !sortOrderColumn) {
        throw new DomainError(
          "replaceByQuery({ sortOrderFromIndex: true }) requires sortOrderColumn to be configured in service options.",
          { status: 500 },
        );
      }

      const condition = buildWhere(table, where);
      const isHard = !deletedAtColumn;

      // where の eq 制約（and 直下含む）をスコープ制約として収集する。
      // or 分岐内の eq は「全行に必ず成立する制約」ではないため対象外。
      const scopeConstraints = new Map<string, unknown>();
      const collectScopeConstraints = (expr: WhereExpr): void => {
        if ("and" in expr) {
          expr.and.forEach(collectScopeConstraints);
          return;
        }
        if ("or" in expr) return;
        if (expr.op === "eq") scopeConstraints.set(expr.field, expr.value);
      };
      collectScopeConstraints(where);

      // field 表記（プロパティ名 / DB カラム名）をプロパティ名に解決
      const columnToProperty = buildColumnToPropertyMap(table);
      const propertyNames = new Set(columnToProperty.values());
      const resolvedScope = new Map<string, unknown>();
      for (const [field, value] of scopeConstraints) {
        const prop = propertyNames.has(field) ? field : columnToProperty.get(field);
        if (prop) resolvedScope.set(prop, value);
      }

      return withCrudEnhancements(async () => {
        const parsedRecords = await Promise.all(
          records.map(async (data, index) => {
            const normalizedData = normalizeRecordKeys(
              table,
              data as Record<string, unknown>,
            ) as Record<string, unknown>;

            // スコープ制約カラムの未指定値を where の値で補完（Zod required 対策で parse 前）
            for (const [prop, value] of resolvedScope) {
              if (normalizedData[prop] === undefined) normalizedData[prop] = value;
            }

            const parsedInput = serviceOptions.parseCreate
              ? await serviceOptions.parseCreate(normalizedData as Insert)
              : normalizedData;

            const { sanitizedData, relationValues } = separateBelongsToManyInput(
              parsedInput as Partial<Insert>,
              belongsToManyRelations,
            );
            // Zod default（[] 等）で常時注入される空の M2M 値は同期不要のため黙って落とす。
            // 実値が入っている場合のみ非対応として reject（fail-closed）。
            const hasRelationInput = Array.from(relationValues.values()).some((value) =>
              Array.isArray(value) ? value.length > 0 : value != null,
            );
            if (hasRelationInput) {
              throw new DomainError(
                "replaceByQuery() does not support belongsToMany fields. Use create() individually for relation sync.",
                { status: 500 },
              );
            }

            const finalInsert = coerceEmptyArraysToNull(
              table,
              applyInsertDefaults(sanitizedData as Insert, serviceOptions),
            ) as Record<string, unknown>;

            // Zod スキーマ外のスコープ制約カラム（parse で strip された場合）を復元
            for (const [prop, value] of resolvedScope) {
              if (finalInsert[prop] === undefined) finalInsert[prop] = value;
            }

            // スコープガード（fail-closed）: where の eq 制約と食い違う record は全体を拒否
            for (const [prop, value] of resolvedScope) {
              if (!isSameScopeValue(finalInsert[prop], value)) {
                throw new DomainError(
                  `replaceByQuery(): records[${index}].${prop} が where のスコープ条件と一致しません`,
                  { status: 422 },
                );
              }
            }
            return finalInsert;
          }),
        );

        // sortOrderFromIndex: 配列順で fractional sort key を採番（明示値より優先）
        if (replaceOptions?.sortOrderFromIndex && sortOrderColumn) {
          const sortOrderFieldName = (sortOrderColumn as any).name as string;
          const keys = generateInitialSortKeys(parsedRecords.length);
          parsedRecords.forEach((record, i) => {
            record[sortOrderFieldName] = keys[i];
          });
        }

        // audit detail 用の削除前スナップショット
        let deletedRows: Record<string, unknown>[] = [];
        const needsDeletedRows = audit && auditBulkMode === "detail";

        const perform = async (executor: DbExecutor): Promise<Select[]> => {
          if (needsDeletedRows) {
            deletedRows = (await executor
              .select()
              .from(table as any)
              .where(condition)) as Record<string, unknown>[];
          }

          let deletedIds: string[] = [];
          if (deletedAtColumn) {
            const rows = (await executor
              .update(table)
              .set({ deletedAt: new Date() } as PgUpdateSetSource<TTable>)
              .where(condition)
              .returning({ id: idColumn })) as { id: unknown }[];
            deletedIds = rows.map((r) => String(r.id));
          } else {
            try {
              const rows = (await executor
                .delete(table)
                .where(condition)
                .returning({ id: idColumn })) as { id: unknown }[];
              deletedIds = rows.map((r) => String(r.id));
            } catch (error) {
              handleConstraintError(error);
            }
          }

          let inserted: Select[] = [];
          if (parsedRecords.length > 0) {
            inserted = (await executor
              .insert(table)
              .values(parsedRecords as any[])
              .returning()) as Select[];
          }

          if (audit && auditBulkMode === "aggregate") {
            await auditOnBulkAggregate(executor, "replaced", {
              deletedCount: deletedIds.length,
              insertedCount: inserted.length,
              sampleDeletedIds: deletedIds.slice(0, 10),
              sampleInsertedIds: inserted
                .slice(0, 10)
                .map((r) => auditIdOf(r as Record<string, unknown>)),
              criteria: where as unknown as Record<string, unknown>,
            });
          } else if (audit && auditBulkMode === "detail") {
            for (const before of deletedRows) {
              await auditOnDelete(executor, before, { hard: isHard });
            }
            for (const row of inserted) {
              await auditOnCreate(executor, row as Record<string, unknown>);
            }
          }

          return inserted;
        };

        // 削除 + 挿入のアトミック性が本メソッドの本質のため、外部 tx がなければ必ず内部 tx を張る
        const results = tx
          ? await perform(tx)
          : await db.transaction(async (innerTx) => perform(innerTx));
        return results;
      });
    },
    /**
     * 複数レコードを一括で更新する。
     * 存在しないIDはスキップされ、notFoundIdsに含まれる。
     */
    async bulkUpdate(
      records: BulkUpdateRecord<Partial<Insert>>[],
      tx?: DbTransaction,
    ): Promise<BulkUpdateResult<Select>> {
      if (records.length === 0) {
        return { results: [], count: 0, notFoundIds: [] };
      }

      const ids = records.map((r) => r.id);
      const hasBelongsToMany = belongsToManyRelations.length > 0;

      const performBulkUpdate = async (executor: DbTransaction | typeof db): Promise<BulkUpdateResult<Select>> => {
        // 存在するレコードを確認
        const existingRows = await executor
          .select({ id: idColumn })
          .from(table as any)
          .where(inArray(idColumn, ids)) as unknown as { id: string }[];
        const existingIds = new Set(existingRows.map((r) => r.id));
        const notFoundIds = ids.filter((id) => !existingIds.has(id));

        const validRecords = records.filter((r) => existingIds.has(r.id));
        if (validRecords.length === 0) {
          return { results: [], count: 0, notFoundIds };
        }

        // detail モード: 全 valid レコードの before を取得
        let beforeSnapshots: Map<string, Record<string, unknown>> | undefined;
        if (audit && auditBulkMode === "detail") {
          beforeSnapshots = await fetchAuditBeforeSnapshots(
            executor,
            validRecords.map((r) => r.id),
          );
        }

        // 全レコードのパース・分離を先に実行
        // updatedAtはmap外で1回だけ生成し、全レコードで同じ参照を共有させる
        // （map内で毎回new Date()すると===比較でfalseになりCASE式パスに入ってしまう）
        const bulkUpdatedAt = serviceOptions.useUpdatedAt ? new Date() : undefined;
        const parsed = await Promise.all(
          validRecords.map(async (record) => {
            const parsedInput = serviceOptions.parseUpdate
              ? await serviceOptions.parseUpdate(record.data)
              : record.data;
            const { sanitizedData, relationValues } = separateBelongsToManyInput(
              parsedInput,
              belongsToManyRelations,
            );
            const updateData = coerceEmptyArraysToNull(table, omitUndefined({
              ...sanitizedData,
              ...(bulkUpdatedAt && { updatedAt: bulkUpdatedAt }),
            })) as Record<string, any>;
            return { id: record.id, updateData, relationValues };
          }),
        );

        // カラム更新があるレコードを抽出
        const recordsWithColumnUpdates = parsed.filter(
          (p) => Object.keys(p.updateData).length > 0,
        );

        // CASE WHEN 方式で1クエリにまとめてUPDATE
        if (recordsWithColumnUpdates.length > 0) {
          // 更新対象カラム名を収集（全レコード横断）
          const allColumns = new Set<string>();
          for (const p of recordsWithColumnUpdates) {
            for (const key of Object.keys(p.updateData)) {
              allColumns.add(key);
            }
          }

          const bulkIds = recordsWithColumnUpdates.map((p) => p.id);
          const setClause: Record<string, any> = {};

          for (const col of allColumns) {
            // 全レコードで同一値なら直接セット（CASE不要）
            // ===は参照比較のためDate/jsonb/配列等のオブジェクト型で誤判定する。値ベースで比較する
            const values = recordsWithColumnUpdates.map((p) => p.updateData[col]);
            const allSame = values.every((v) => isBulkValueEqual(v, values[0]));

            if (allSame) {
              setClause[col] = values[0];
            } else {
              // レコードごとに異なる値: CASE WHEN 方式
              const colRef = (table as Record<string, any>)[col];
              const fragments = recordsWithColumnUpdates.map((p) => {
                const val = p.updateData[col];
                return val !== undefined
                  ? sql`WHEN ${p.id} THEN ${val}`
                  : sql`WHEN ${p.id} THEN ${colRef}`;
              });
              setClause[col] = sql.join(
                [sql`CASE ${idColumn}`, ...fragments, sql`END`],
                sql` `,
              );
            }
          }

          await executor
            .update(table)
            .set(setClause as PgUpdateSetSource<TTable>)
            .where(inArray(idColumn, bulkIds));
        }

        // belongsToMany リレーションを同期
        // 同一リレーション値のレコードをグルーピングして bulkSync 適用
        const recordsWithRelations = parsed.filter((p) => p.relationValues.size > 0);
        if (recordsWithRelations.length > 0) {
          // リレーション値をキーにグルーピング
          const groups = new Map<string, string[]>();
          for (const p of recordsWithRelations) {
            const key = JSON.stringify(
              Array.from(p.relationValues.entries()).sort(([a], [b]) => a.localeCompare(b)),
            );
            const group = groups.get(key) ?? [];
            group.push(p.id);
            groups.set(key, group);
          }

          for (const [key, groupIds] of groups) {
            const relationValues = recordsWithRelations.find(
              (p) => JSON.stringify(
                Array.from(p.relationValues.entries()).sort(([a], [b]) => a.localeCompare(b)),
              ) === key,
            )!.relationValues;
            await bulkSyncBelongsToManyRelations(
              executor as DbTransaction,
              belongsToManyRelations,
              groupIds,
              relationValues,
            );
          }
        }

        // 更新後のレコードを1クエリで取得
        const validIds = validRecords.map((r) => r.id);
        const updatedRows = (await executor
          .select()
          .from(table as any)
          .where(inArray(idColumn, validIds))) as Select[];

        // ローカルでリレーション値をアサイン
        for (const row of updatedRows) {
          const p = parsed.find((pp) => pp.id === (row as any).id);
          if (p && p.relationValues.size > 0) {
            assignLocalRelationValues(row as any, belongsToManyRelations, p.relationValues);
          }
        }

        // audit
        if (audit && auditBulkMode === "aggregate") {
          await auditOnBulkAggregate(
            executor,
            "updated",
            {
              count: updatedRows.length,
              sampleIds: updatedRows.slice(0, 10).map((r) => auditIdOf(r as Record<string, unknown>)),
            },
          );
        } else if (audit && auditBulkMode === "detail" && beforeSnapshots) {
          for (const row of updatedRows) {
            const id = auditIdOf(row as Record<string, unknown>);
            const before = beforeSnapshots.get(id);
            if (before) await auditOnUpdate(executor, before, row as Record<string, unknown>);
          }
        }

        return { results: updatedRows, count: updatedRows.length, notFoundIds };
      };

      if (tx) {
        return performBulkUpdate(tx);
      }
      // audit ありで bulkMode が off 以外の場合は tx を強制する（aggregate でも記録するため）
      if (hasBelongsToMany || (audit && audit.bulkMode !== "off")) {
        return db.transaction(async (innerTx) => performBulkUpdate(innerTx));
      }
      return performBulkUpdate(db);
    },
  };
}
