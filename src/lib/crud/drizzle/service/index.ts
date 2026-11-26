// src/lib/crud/drizzle/service/index.ts
// Drizzle の CRUD サービス createCrudService の組み立て: 共有の状態(context)を作り、操作の群(read / write / bulk / upsert / table / sort)を
// 1 つのサービスにまとめ、集まり・ストレージ連動・リクエストメモ・秘匿カラムの包みを掛ける。制約違反の判定は errors.ts

import { db } from "@/lib/drizzle";
import { inArray } from "drizzle-orm";
import { DomainError } from "@/lib/errors";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { PgTable, AnyPgColumn } from "drizzle-orm/pg-core";
import type { BoundedSearchParams, PaginatedResult, DuplicateOptions, WithOptions } from "../../types";
import { buildOrderBy } from "../query";
import { buildDuplicateData, resolveConflictTarget } from "../utils";
import type { CrudServiceOptions, DbTransaction, ExtraWhereClause } from "../types";
import { applyRequestMemo } from "../requestMemo";
import { applyCacheTags } from "../cacheTags";
import { applyHiddenColumns } from "../hiddenColumns";
import { applyStorageBinding } from "../../storageIntegration/applyStorageBinding";
import { applyCollectionDuplicate, applyCollections } from "../../collections/applyCollections";
import type { CollectionDuplicateResult, CollectionFieldsAugmented } from "../../collections/types";
import type { StorageFieldsAugmented } from "../../storageIntegration/types";
import { createBulkMethods } from "./bulk";
import { createServiceContext } from "./context";
import { createReadMethods } from "./read";
import { createSortMethods } from "./sort";
import { createTableMethods } from "./table";
import { createUpsertMethods } from "./upsert";
import { createWriteMethods } from "./write";

export type DefaultInsert<TTable extends PgTable> = Omit<
  InferInsertModel<TTable>,
  "id" | "createdAt" | "updatedAt"
>;

export function createCrudService<
  TTable extends PgTable & { id: AnyPgColumn },
  TCreate extends Record<string, any> = DefaultInsert<TTable>
>(table: TTable, serviceOptions: CrudServiceOptions<TCreate> = {}) {
  type Select = InferSelectModel<TTable>;
  type Insert = TCreate;
  const ctx = createServiceContext<TTable, TCreate>(table, serviceOptions);
  const { idColumn, belongsToManyRelations, sortOrderColumn, deletedAtColumn } = ctx;

  // 群ごとのメソッドを 1 つのサービスにまとめる。自分の他のメソッドを this で呼ぶ物(duplicate・duplicateWithIdMap・searchForSorting)は
  // ここに置く: this = 呼ばれたサービス(collections / storage の包みの後)のまま、create などが包みを通る
  const service = {
    ...createWriteMethods<TTable, TCreate>(ctx),
    ...createReadMethods<TTable, TCreate>(ctx),
    ...createBulkMethods<TTable, TCreate>(ctx),
    ...createUpsertMethods<TTable, TCreate>(ctx),
    ...createTableMethods<TTable, TCreate>(ctx),
    ...createSortMethods<TTable, TCreate>(ctx),
    async duplicate(id: string, options?: DuplicateOptions, tx?: DbTransaction): Promise<Select> {
      const record = await this.get(id);
      if (!record) {
        throw new Error(`Record not found: ${id}`);
      }

      const newData = buildDuplicateData(record as Record<string, unknown>, options);
      return this.create(newData as unknown as Insert, tx);
    },
    /**
     * duplicate と同じ複製をし、集まりの項目ごとの「複製元の従属の id → 複製した従属の id」の対応表も返す。
     * collections オプションの無いサービスでは idMaps は空（複製は duplicate のまま）
     */
    async duplicateWithIdMap(
      id: string,
      options?: DuplicateOptions,
      tx?: DbTransaction,
    ): Promise<CollectionDuplicateResult<Select>> {
      return { record: await this.duplicate(id, options, tx), idMaps: {} };
    },
    /**
     * ソート画面用の検索メソッド。
     * 結果に sort_order が NULL のレコードがあれば自動的に初期化する。
     * 初期化順序は defaultOrderBy（未設定時は createdAt DESC）に従う。
     *
     * @param params - 検索パラメータ
     * @returns 検索結果（NULL が初期化済み）
     */
    async searchForSorting(params: BoundedSearchParams & WithOptions & ExtraWhereClause): Promise<PaginatedResult<Select>> {
      if (!sortOrderColumn) {
        throw new DomainError(
          "searchForSorting() requires sortOrderColumn to be configured in service options.",
          { status: 500 }
        );
      }

      const sortOrderFieldName = (sortOrderColumn as any).name as string;

      // 通常の検索を実行
      const results = await this.search(params);

      // sort_order が NULL のアイテムを抽出
      const nullItems = results.results.filter(
        (item: any) => item[sortOrderFieldName] === null || item[sortOrderFieldName] === undefined
      );

      if (nullItems.length === 0) {
        return results;
      }

      // NULL アイテムのIDを取得
      const nullIds = nullItems.map((item: any) => item.id as string);

      // defaultOrderBy に従って NULL アイテムの順序を決定
      const initOrderBy = serviceOptions.defaultOrderBy ?? [["createdAt", "DESC"]];
      const orderedNullItems = await db
        .select({ id: idColumn })
        .from(table as any)
        .where(inArray(idColumn, nullIds))
        .orderBy(...buildOrderBy(table, initOrderBy, { sortKeyColumn: sortOrderColumn })) as { id: string }[];

      const orderedNullIds = orderedNullItems.map((item) => String(item.id));

      // sort_order を初期化し、割り当てられたキーマップを取得
      const keyMap = await this.initializeSortOrder(orderedNullIds);

      // 1回目の結果に初期化された sort_order をマージ（再searchを回避）
      for (const item of results.results) {
        const assignedKey = keyMap.get((item as any).id);
        if (assignedKey !== undefined) {
          (item as any)[sortOrderFieldName] = assignedKey;
        }
      }

      return results;
    },
  };

  // requestMemo: get のリクエストスコープメモ化 + 書き込みメソッドでの自動 invalidate。
  // 無効時も invalidateRequestMemo (no-op) を公開し、サービスの形を一定に保つ。
  // hiddenColumns: テーブルに defineHiddenColumns() の宣言があれば、最外層で
  // 全メソッドの戻り値から秘匿カラムを null 化する（audit / memo は生値で動作済み）。
  // collections: ドメイン集約の差分同期。指定したサービスだけ書き込み系メソッドを包む（未指定なら service そのまま）。
  // storage: ファイル台帳との連動。指定したサービスだけ書き込み系メソッドを包み、storageFields を出す（未指定なら service そのまま）。
  const withCollections: typeof service & CollectionFieldsAugmented = serviceOptions.collections?.length
    ? applyCollections(service, {
        table,
        collections: serviceOptions.collections,
        reservedFieldNames: belongsToManyRelations.map((relation) => relation.fieldName),
      })
    : service;
  const withStorage: typeof service & StorageFieldsAugmented = serviceOptions.storage
    ? applyStorageBinding(withCollections, {
        table,
        binding: serviceOptions.storage,
        useSoftDelete: Boolean(deletedAtColumn),
        conflictTarget: (upsertOptions) => resolveConflictTarget(table, serviceOptions, upsertOptions),
      })
    : withCollections;
  // collections の複製は storage binding の外側で包む（主のファイルは storage 層の duplicateStorageValues で写し、
  // 主の create は storage binding → 集まりの層を通る）
  const withCollectionDuplicate: typeof withStorage = serviceOptions.collections?.length
    ? applyCollectionDuplicate(withStorage, serviceOptions.collections)
    : withStorage;
  // cacheTags: 書き込みのメソッドが終わりにこのドメインのキャッシュタグを積む(消すのは入口の runWithCacheTags)。memo の外側で包む
  return applyHiddenColumns(
    applyCacheTags(applyRequestMemo(withCollectionDuplicate, serviceOptions.requestMemo === true), serviceOptions.cacheTags),
    table,
  );
}
