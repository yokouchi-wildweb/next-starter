// src/lib/crud/collections/applyCollections.ts
//
// createCrudService の `collections` オプションの実装。書き込み系メソッドを包み、主の行の書き込みと
// 同じ TX の中で syncCollection の同期を呼ぶ。collections を指定しないサービスには適用しない。
// - create / update / upsert: 集まりの項目を parse の前に入力から外して検査（DB に触れる前に 400）→
//   主の行を書く → 項目ごとに差分同期。項目の省略 = 維持、[] = 全部消す。戻り値に書いた値の配列を載せる
// - bulkUpsert / bulkUpdate / bulkUpdateByIds / bulkUpdateByQuery / replaceByQuery: 集まりの値
//   （[] を含む）が入っていれば DB を変える前に 400。値が無ければ今のまま
// - 読み出しの 7 口（get / getWithDeleted / list / listWithDeleted / search / searchWithDeleted /
//   searchForSorting）: 返した主の行に、集まりごとに値の配列を全件（件数の上限なし）並び順で載せる。
//   集まり 1 つにつき呼び出し 1 回で 1 クエリ（主の id の IN）。従属が無ければ []。restore / reorder /
//   systemUpdate / bulk 系の戻り値には載せない（省略 = 維持なので保存しても失わない）
// - collectionFields: 集まりの項目名を読み取り専用で出す（dataMigration の拒否・書き出しの除外が使う）
// - duplicate / duplicateWithIdMap: applyCollectionDuplicate が storage binding の外側で包み、
//   duplicateWithCollections（2 段の複製）を呼ぶ
// - 呼び出し元が tx を渡さなければ内部で TX を張る（従属の hardDelete のファイルの片付けは従属の
//   storage binding の動きのまま: 外から tx を渡すので掃除 cron が片付ける）

import { getTableColumns, inArray } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";

import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors";
import type { ReplaceByQueryOptions, WhereExpr } from "@/lib/crud/types";

import type { DbTransaction } from "../drizzle/types";
import type { DuplicateOptions } from "@/lib/crud/types";

import { collectionOrderBy } from "./collectionOrder";
import { duplicateWithCollections } from "./duplicateWithCollections";
import { resolveCollectionColumns, syncCollectionInTx, validateCollectionValues } from "./syncCollection";
import type { CollectionDuplicateParentService, CollectionValue, CrudCollectionConfig } from "./types";

type Row = Record<string, unknown>;

type ApplyCollectionsContext = {
  table: PgTable & { id: AnyPgColumn };
  collections: readonly CrudCollectionConfig[];
  /** belongsToMany のフィールド名（集まりの項目名と重ねない） */
  reservedFieldNames: readonly string[];
};

type PaginatedRows = { results: any[] };

type CollectionAwareService = {
  get(id: string, options?: any): Promise<any>;
  getWithDeleted(id: string, options?: any): Promise<any>;
  list(options?: any): Promise<any[]>;
  listWithDeleted(options?: any): Promise<any[]>;
  search(params?: any): Promise<PaginatedRows>;
  searchWithDeleted(params?: any): Promise<PaginatedRows>;
  searchForSorting(params: any): Promise<PaginatedRows>;
  create(data: any, tx?: DbTransaction): Promise<any>;
  update(id: string, data: any, tx?: DbTransaction): Promise<any>;
  upsert(data: any, upsertOptions?: any, tx?: DbTransaction): Promise<any>;
  bulkUpdateByIds(ids: string[], data: any, tx?: DbTransaction): Promise<any>;
  bulkUpdateByQuery(where: WhereExpr, data: any, tx?: DbTransaction): Promise<any>;
  bulkUpdate(records: { id: string; data: any }[], tx?: DbTransaction): Promise<any>;
  bulkUpsert(records: any[], options?: any, tx?: DbTransaction): Promise<any>;
  replaceByQuery(where: WhereExpr, records: any[], replaceOptions?: ReplaceByQueryOptions, tx?: DbTransaction): Promise<any[]>;
};

const hasOwn = Object.prototype.hasOwnProperty;

export function applyCollections<TService extends CollectionAwareService>(
  service: TService,
  context: ApplyCollectionsContext,
): TService & { readonly collectionFields: readonly string[] } {
  const { table, collections } = context;

  // 宣言の誤りはサービス生成時に throw する
  const parentColumnKeys = new Set(Object.keys(getTableColumns(table)));
  const fieldNames = new Set<string>();
  const resolved = collections.map((collection) => {
    const name = collection.fieldName;
    if (parentColumnKeys.has(name) || context.reservedFieldNames.includes(name) || fieldNames.has(name)) {
      throw new Error(`collections "${name}": fieldName must not be a column, a belongsToMany field or another collection.`);
    }
    fieldNames.add(name);
    return resolveCollectionColumns(collection);
  });

  const touchesCollections = (data: unknown): boolean =>
    Boolean(data) &&
    typeof data === "object" &&
    collections.some((collection) => (data as Row)[collection.fieldName] !== undefined);

  const rejectBulkWrite = (operation: string): never => {
    throw new DomainError(
      `${operation} では集まりの項目（${[...fieldNames].join(", ")}）を変更できません。行ごとに create / update / upsert を使ってください`,
      { status: 400 },
    );
  };

  /** 入力から集まりの項目を外して検査する（DB に触れる前）。undefined の項目は省略 = 維持 */
  const separate = (data: unknown): { rest: any; values: Map<number, CollectionValue[]> } => {
    const values = new Map<number, CollectionValue[]>();
    if (!data || typeof data !== "object") return { rest: data, values };
    const rest: Row = { ...(data as Row) };
    collections.forEach((collection, index) => {
      if (!hasOwn.call(rest, collection.fieldName)) return;
      const value = rest[collection.fieldName];
      delete rest[collection.fieldName];
      if (value !== undefined) values.set(index, validateCollectionValues(collection, value));
    });
    return { rest, values };
  };

  const runInTx = <T>(tx: DbTransaction | undefined, work: (executor: DbTransaction) => Promise<T>): Promise<T> =>
    tx ? work(tx) : db.transaction((innerTx) => work(innerTx));

  /** 書いた主の行の集まりを同期し、戻り値に値の配列を載せる */
  const syncAll = async (executor: DbTransaction, record: Row, values: Map<number, CollectionValue[]>) => {
    for (const [index, collectionValues] of values) {
      const collection = collections[index];
      await syncCollectionInTx(
        executor,
        { parentTable: table, parentId: record.id as string | number, collection, values: collectionValues },
        resolved[index],
      );
      record[collection.fieldName] = collectionValues;
    }
  };

  /** 主の行に集まりの値の配列を載せる（集まりごとに 1 クエリ、件数の上限なし） */
  const project = async (records: readonly Row[]): Promise<void> => {
    const rows = records.filter((record): record is Row => Boolean(record));
    if (!rows.length) return;
    const parentIds = [...new Set(rows.map((record) => record.id as CollectionValue))];
    for (const [index, collection] of collections.entries()) {
      const children = (await db
        .select({ parentId: collection.parentColumn, value: collection.valueColumn })
        .from(resolved[index].childTable as any)
        .where(inArray(collection.parentColumn, parentIds))
        .orderBy(collection.parentColumn, ...collectionOrderBy(collection, resolved[index]))) as Row[];
      const valuesByParent = new Map<unknown, CollectionValue[]>();
      for (const child of children) {
        const values = valuesByParent.get(child.parentId);
        if (values) values.push(child.value as CollectionValue);
        else valuesByParent.set(child.parentId, [child.value as CollectionValue]);
      }
      for (const record of rows) {
        record[collection.fieldName] = valuesByParent.get(record.id) ?? [];
      }
    }
  };

  const projectOne = async <T>(record: T): Promise<T> => {
    if (record) await project([record as Row]);
    return record;
  };

  const projectMany = async <T extends Row[]>(records: T): Promise<T> => {
    await project(records);
    return records;
  };

  const projectPage = async <T extends PaginatedRows>(page: T): Promise<T> => {
    await project(page.results);
    return page;
  };

  const wrapped: TService & { readonly collectionFields: readonly string[] } = {
    ...service,

    collectionFields: Object.freeze([...fieldNames]),

    async get(id, options) {
      return projectOne(await service.get(id, options));
    },

    async getWithDeleted(id, options) {
      return projectOne(await service.getWithDeleted(id, options));
    },

    async list(options) {
      return projectMany(await service.list(options));
    },

    async listWithDeleted(options) {
      return projectMany(await service.listWithDeleted(options));
    },

    async search(params) {
      return projectPage(await service.search(params));
    },

    async searchWithDeleted(params) {
      return projectPage(await service.searchWithDeleted(params));
    },

    // base の searchForSorting は this.search を呼ぶ。service から呼ぶので射影は包んだここの 1 回だけ
    async searchForSorting(params) {
      return projectPage(await service.searchForSorting(params));
    },

    async create(data, tx) {
      const { rest, values } = separate(data);
      if (!values.size) return service.create(rest, tx);
      return runInTx(tx, async (executor) => {
        const created = await service.create(rest, executor);
        if (created) await syncAll(executor, created as Row, values);
        return created;
      });
    },

    async update(id, data, tx) {
      const { rest, values } = separate(data);
      if (!values.size) return service.update(id, rest, tx);
      return runInTx(tx, async (executor) => {
        const updated = await service.update(id, rest, executor);
        if (updated) await syncAll(executor, updated as Row, values);
        return updated;
      });
    },

    async upsert(data, upsertOptions, tx) {
      const { rest, values } = separate(data);
      if (!values.size) return service.upsert(rest, upsertOptions, tx);
      return runInTx(tx, async (executor) => {
        const upserted = await service.upsert(rest, upsertOptions, executor);
        if (upserted) await syncAll(executor, upserted as Row, values);
        return upserted;
      });
    },

    async bulkUpdateByIds(ids, data, tx) {
      if (touchesCollections(data)) rejectBulkWrite("bulkUpdateByIds");
      return service.bulkUpdateByIds(ids, data, tx);
    },

    async bulkUpdateByQuery(where, data, tx) {
      if (touchesCollections(data)) rejectBulkWrite("bulkUpdateByQuery");
      return service.bulkUpdateByQuery(where, data, tx);
    },

    async bulkUpdate(records, tx) {
      if (records.some((record) => touchesCollections(record.data))) rejectBulkWrite("bulkUpdate");
      return service.bulkUpdate(records, tx);
    },

    async bulkUpsert(records, options, tx) {
      if (records.some((record) => touchesCollections(record))) rejectBulkWrite("bulkUpsert");
      return service.bulkUpsert(records, options, tx);
    },

    async replaceByQuery(where, records, replaceOptions, tx) {
      if (records.some((record) => touchesCollections(record))) rejectBulkWrite("replaceByQuery");
      return service.replaceByQuery(where, records, replaceOptions, tx);
    },
  };

  return wrapped;
}

type DuplicateAwareService = CollectionDuplicateParentService & {
  duplicate(id: string, options?: DuplicateOptions, tx?: DbTransaction): Promise<any>;
  duplicateWithIdMap(id: string, options?: DuplicateOptions, tx?: DbTransaction): Promise<any>;
};

/**
 * duplicate / duplicateWithIdMap を 2 段の複製（duplicateWithCollections）に差し替える。
 * storage binding の外側で包む: 主の get・create・duplicateStorageValues はこの包んだサービス自身を通るので、
 * 主のファイルは主の binding で写して紐付き、主の create は集まりの層（項目なし = そのまま）を通る
 */
export function applyCollectionDuplicate<TService extends DuplicateAwareService>(
  service: TService,
  collections: readonly CrudCollectionConfig[],
): TService {
  const wrapped: TService = {
    ...service,

    async duplicate(id, options, tx) {
      return (await duplicateWithCollections({ service: wrapped, collections, id, options }, tx)).record;
    },

    async duplicateWithIdMap(id, options, tx) {
      return duplicateWithCollections({ service: wrapped, collections, id, options }, tx);
    },
  };
  return wrapped;
}
