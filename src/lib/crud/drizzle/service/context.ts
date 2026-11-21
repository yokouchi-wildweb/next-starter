// src/lib/crud/drizzle/service/context.ts
// サービス 1 つ分の共有の状態と道具(関係の設定・論理削除の列・特権書き込みの検査・リレーション展開・一括の共通実装)。群はこれを受けて作る

import { db } from "@/lib/drizzle";
import { omitUndefined } from "../../utils/object";
import { SQL, isNull, getTableName } from "drizzle-orm";
import { DomainError } from "@/lib/errors";
import type { PgTable, AnyPgColumn, PgUpdateSetSource } from "drizzle-orm/pg-core";
import type { BulkRelationResult, WhereExpr, WithOptions, HasManyRelation } from "../../types";
import { buildWhere } from "../query";
import { buildColumnToPropertyMap, coerceEmptyArraysToNull, normalizeRecordKeys } from "../utils";
import type { CrudServiceOptions, DbTransaction, DbExecutor } from "../types";
import { bulkAddBelongsToManyRelation, bulkRemoveBelongsToManyRelation, BULK_RELATION_MAX_IDS, BULK_RELATION_MAX_TARGET_IDS } from "../belongsToMany";
import { hydrateBelongsTo, hydrateBelongsToManyObjects, hydrateHasMany, DEFAULT_HAS_MANY_LIMIT, hydrateCount } from "../relations";
import { getHiddenColumnProps } from "../hiddenColumns";
import { createAuditHooks } from "./audit";
import { handleConstraintError } from "./errors";
import { resolveRelationDepth } from "./helpers";

export function createServiceContext<TTable extends PgTable & { id: AnyPgColumn }, TCreate extends Record<string, any>>(
  table: TTable,
  serviceOptions: CrudServiceOptions<TCreate>,
) {
  const idColumn = table.id;
  const belongsToManyRelations = serviceOptions.belongsToManyRelations ?? [];
  const useSoftDelete = serviceOptions.useSoftDelete ?? false;

  // ===== 監査ログ（audit）統合（audit.ts） =====
  const auditHooks = createAuditHooks<TTable, TCreate>(table, idColumn, serviceOptions);
  const { audit, auditBulkMode, auditIdOf, auditTxOf, auditCommonOptions, auditOnUpdate, auditOnBulkAggregate, fetchAuditBeforeSnapshots } = auditHooks;

  /** bulkAddRelation / bulkRemoveRelation の共通実装。中間テーブルの書き込みと監査を同じ TX にする */
  const performBulkRelationChange = async (
    verb: "added" | "removed",
    fieldName: string,
    ids: string[],
    targetIds: string[],
    tx?: DbTransaction,
  ): Promise<BulkRelationResult> => {
    const relation = (serviceOptions.belongsToManyRelations ?? []).find((item) => item.fieldName === fieldName);
    if (!relation) {
      throw new DomainError(`belongsToMany の項目ではありません: ${fieldName}`, { status: 400 });
    }
    if (ids.length > BULK_RELATION_MAX_IDS || targetIds.length > BULK_RELATION_MAX_TARGET_IDS) {
      throw new DomainError(
        `一度に指定できるのはレコード ${BULK_RELATION_MAX_IDS} 件、関連先 ${BULK_RELATION_MAX_TARGET_IDS} 件までです`,
        { status: 400 },
      );
    }

    const source = { table, idColumn };
    const perform = async (executor: DbExecutor): Promise<BulkRelationResult> => {
      const { result, changes } =
        verb === "added"
          ? await bulkAddBelongsToManyRelation(executor, relation, source, ids, targetIds)
          : await bulkRemoveBelongsToManyRelation(executor, relation, source, ids, targetIds);

      if (audit && auditBulkMode === "aggregate" && result.count > 0) {
        await auditOnBulkAggregate(executor, `relation_${verb}`, {
          field: fieldName,
          count: result.count,
          sampleIds: result.affectedIds.slice(0, 10),
          targetIds,
        });
      } else if (audit && auditBulkMode === "detail") {
        for (const [recordId, changedTargetIds] of changes) {
          await audit.recorder.record({
            ...auditCommonOptions()!,
            targetType: audit.targetType,
            targetId: recordId,
            action: `${audit.actionPrefix}.relation.${verb}`,
            metadata: { field: fieldName, targetIds: changedTargetIds },
            tx: auditTxOf(executor),
          });
        }
      }
      return result;
    };

    try {
      if (tx) return await perform(tx);
      return await db.transaction(async (innerTx) => perform(innerTx));
    } catch (error) {
      // 確認の後に相手が物理削除されたときの外部キー違反
      return handleConstraintError(error, "write");
    }
  };

  // ===== systemUpdate / systemBulkUpdateByQuery（特権書き込み）=====
  // systemColumns 宣言をプロパティ名の Set に解決する。
  // 宣言はプロパティ名・DB カラム名のどちらでも受け付け、存在しないカラム名は
  // サービス生成時に即 throw する（typo をデプロイ前に検出するため fail-fast）。
  const systemColumnProps: Set<string> | undefined = (() => {
    const declared = serviceOptions.systemColumns;
    if (!declared || declared.length === 0) return undefined;
    const columnToProperty = buildColumnToPropertyMap(table);
    const propertyNames = new Set(columnToProperty.values());
    const props = new Set<string>();
    for (const name of declared) {
      const prop = propertyNames.has(name) ? name : columnToProperty.get(name);
      if (!prop) {
        throw new Error(
          `systemColumns: unknown column "${name}" on table "${getTableName(table)}".`,
        );
      }
      props.add(prop);
    }
    // メディア列（storage オプションの列）は特権書き込みの対象にできない。台帳との紐付けを
    // 経由しない書き込みになり、ref と台帳の対応が崩れるため（メディア列の書き込みは storage オプション経由だけ）
    const mediaColumns = (serviceOptions.storage?.fields ?? []).map((field) => field.name).filter((name) => props.has(name));
    if (mediaColumns.length > 0) {
      throw new Error(
        `systemColumns: media column(s) "${mediaColumns.join(", ")}" on table "${getTableName(table)}" are bound by the storage option and cannot be system-written.`,
      );
    }
    return props;
  })();

  // メディア列（storage オプションの列）は秘匿カラムにできない。サービスの戻り値で null になり、
  // 掃除（storage-sweep）の照合が「値に ref が無い」と誤って判定してファイルを消すため
  {
    const hidden = getHiddenColumnProps(table);
    const hiddenMedia = (serviceOptions.storage?.fields ?? []).map((field) => field.name).filter((name) => hidden?.has(name));
    if (hiddenMedia.length > 0) {
      throw new Error(
        `hiddenColumns: media column(s) "${hiddenMedia.join(", ")}" on table "${getTableName(table)}" are bound by the storage option and cannot be hidden.`,
      );
    }
  }

  /**
   * system 系メソッドの入力データを検証・整形する。
   * - systemColumns 未宣言のサービスでは常に throw（fail-closed）
   * - 宣言外のキーは throw（parseUpdate バイパスの代償として allowlist を厳密適用）
   * - 値には drizzle の SQL 式（sql`` オブジェクト）を許可する（アトミック加算・CASE 等）
   * - updatedAt はサービス自身が付与するため宣言不要（呼び出し側が明示指定する場合は宣言必須）
   */
  const prepareSystemWriteData = (
    data: Record<string, unknown>,
    methodName: string,
  ): Record<string, unknown> & { updatedAt?: Date } => {
    if (!systemColumnProps) {
      throw new DomainError(
        `${methodName}() requires systemColumns to be configured in service options.`,
        { status: 500 },
      );
    }
    const cleaned = omitUndefined(normalizeRecordKeys(table, data));
    for (const key of Object.keys(cleaned)) {
      if (!systemColumnProps.has(key)) {
        throw new DomainError(
          `${methodName}(): column "${key}" is not declared in systemColumns.`,
          { status: 500 },
        );
      }
    }
    if (Object.keys(cleaned).length === 0) {
      throw new DomainError(
        `${methodName}() requires at least one column to update.`,
        { status: 500 },
      );
    }
    const updateData = coerceEmptyArraysToNull(table, cleaned) as Record<string, unknown> & {
      updatedAt?: Date;
    };
    if (serviceOptions.useUpdatedAt && updateData.updatedAt === undefined) {
      updateData.updatedAt = new Date();
    }
    return updateData;
  };

  /** audit の aggregate metadata 用に、シリアライズ不能な SQL 式の値をマーカー文字列に置換する */
  const maskSqlValues = (record: Record<string, unknown>): Record<string, unknown> =>
    Object.fromEntries(
      Object.entries(record).map(([key, value]) => [
        key,
        value instanceof SQL ? "[sql-expression]" : value,
      ]),
    );

  /**
   * bulkUpdateByQuery / systemBulkUpdateByQuery の共通実装。
   * WhereExpr 条件に一致する行を一括更新し、実際に更新された件数を返す。
   * - 更新本体は UPDATE ... RETURNING id の 1 クエリ（audit 無効時も追加クエリなし）
   * - audit aggregate: 件数 + サンプル ID + 条件スナップショット + patch を 1 行に集約
   * - audit detail: 更新前に条件一致行の before を取得し、更新後に after と突き合わせて個別記録
   * - 条件は buildWhere をそのまま適用する（ソフトデリート済み行の暗黙除外はしない。
   *   既存の bulkDeleteByQuery / update と同じ「書き込み系は暗黙フィルタなし」の原則）
   */
  const performBulkUpdateByQuery = async (
    methodName: string,
    where: WhereExpr,
    updateData: Record<string, unknown>,
    auditPatch: Record<string, unknown> | null,
    tx?: DbTransaction,
  ): Promise<{ count: number }> => {
    if (!where) {
      throw new Error(`${methodName} requires a where condition.`);
    }
    const condition = buildWhere(table, where);

    const perform = async (executor: DbExecutor): Promise<{ count: number }> => {
      // detail モード: 条件一致行の before スナップショットを更新前に取得
      let beforeSnapshots: Map<string, Record<string, unknown>> | undefined;
      if (audit && auditBulkMode === "detail") {
        const rows = (await executor.select().from(table as any).where(condition)) as Record<
          string,
          unknown
        >[];
        beforeSnapshots = new Map(rows.map((row) => [auditIdOf(row), row]));
      }

      const updatedRows = (await executor
        .update(table)
        .set(updateData as PgUpdateSetSource<TTable>)
        .where(condition)
        .returning({ id: idColumn })) as { id: unknown }[];
      const affectedIds = updatedRows.map((row) => String(row.id));

      if (audit && auditBulkMode === "aggregate") {
        await auditOnBulkAggregate(executor, "updated", {
          count: affectedIds.length,
          sampleIds: affectedIds.slice(0, 10),
          criteria: where as unknown as Record<string, unknown>,
          patch: auditPatch,
        });
      } else if (audit && auditBulkMode === "detail" && beforeSnapshots) {
        const afterSnapshots = await fetchAuditBeforeSnapshots(executor, affectedIds);
        for (const [recordId, before] of beforeSnapshots) {
          const after = afterSnapshots.get(recordId);
          if (after) await auditOnUpdate(executor, before, after);
        }
      }
      return { count: affectedIds.length };
    };

    if (audit && audit.bulkMode !== "off" && !tx) {
      return db.transaction(async (innerTx) => perform(innerTx));
    }
    return perform(tx ?? db);
  };

  // withRelations / withCount 用のリレーション設定
  const belongsToRelations = serviceOptions.belongsToRelations ?? [];
  const belongsToManyObjectRelations = serviceOptions.belongsToManyObjectRelations ?? [];
  const hasManyRelations = serviceOptions.hasManyRelations ?? [];
  const countableRelations = serviceOptions.countableRelations ?? [];
  // reorder 用の sortOrder カラム
  const sortOrderColumn = serviceOptions.sortOrderColumn;
  // ソフトデリート用カラム（テーブルに deletedAt がある場合のみ）
  const deletedAtColumn = useSoftDelete
    ? ((table as any).deletedAt as AnyPgColumn | undefined)
    : undefined;

  // ソフトデリート用のフィルター条件を生成
  const buildSoftDeleteFilter = (): SQL | undefined => {
    if (!deletedAtColumn) return undefined;
    return isNull(deletedAtColumn);
  };

  /**
   * withRelations / withCount のリレーション展開を共通化したヘルパー。
   * belongsTo → belongsToMany → hasMany の順に展開し、withCount も処理する。
   */
  const hydrateRelations = async (
    records: Record<string, any>[],
    options?: WithOptions,
  ): Promise<void> => {
    const depth = resolveRelationDepth(options?.withRelations);

    if (depth > 0) {
      const hasManyLimit = options?.hasManyLimit ?? DEFAULT_HAS_MANY_LIMIT;

      // ネスト展開用のラップ関数（循環参照回避のため引数で渡す）
      const wrappedHydrateHasMany = async (
        recs: Record<string, any>[],
        rels: HasManyRelation[],
        d: number,
      ) => {
        await hydrateHasMany(recs, rels, d, hasManyLimit, hydrateBelongsTo, hydrateBelongsToManyObjects);
      };

      const wrappedHydrateBelongsToMany = async (
        recs: Record<string, any>[],
        rels: typeof belongsToManyObjectRelations,
        d: number,
      ) => {
        await hydrateBelongsToManyObjects(recs, rels, d, hydrateBelongsTo, wrappedHydrateHasMany);
      };

      if (belongsToRelations.length) {
        await hydrateBelongsTo(records, belongsToRelations, depth, wrappedHydrateBelongsToMany, wrappedHydrateHasMany);
      }
      if (belongsToManyObjectRelations.length) {
        await hydrateBelongsToManyObjects(records, belongsToManyObjectRelations, depth, hydrateBelongsTo, wrappedHydrateHasMany);
      }
      if (hasManyRelations.length) {
        await hydrateHasMany(
          records,
          hasManyRelations,
          depth,
          hasManyLimit,
          hydrateBelongsTo,
          hydrateBelongsToManyObjects,
        );
      }
    }

    if (options?.withCount && countableRelations.length) {
      await hydrateCount(records, countableRelations);
    }
  };

  return {
    table,
    serviceOptions,
    ...auditHooks,
    idColumn,
    belongsToManyRelations,
    useSoftDelete,
    performBulkRelationChange,
    systemColumnProps,
    prepareSystemWriteData,
    maskSqlValues,
    performBulkUpdateByQuery,
    belongsToRelations,
    belongsToManyObjectRelations,
    hasManyRelations,
    countableRelations,
    sortOrderColumn,
    deletedAtColumn,
    buildSoftDeleteFilter,
    hydrateRelations,
  };
}

/** 操作の群(read / write / bulk …)が共有する、サービス 1 つ分の状態と道具 */
export type ServiceContext<TTable extends PgTable & { id: AnyPgColumn }, TCreate extends Record<string, any>> = ReturnType<typeof createServiceContext<TTable, TCreate>>;
