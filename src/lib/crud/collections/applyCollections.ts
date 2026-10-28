// src/lib/crud/collections/applyCollections.ts
//
// createCrudService の `collections` オプションの実装。書き込み系メソッドを包み、主の行の書き込みと
// 同じ TX の中で syncCollection の同期を呼ぶ。collections を指定しないサービスには適用しない。
// - create / update / upsert: 集まりの項目を parse の前に入力から外して検査（DB に触れる前に 400）→
//   主の行を書く → 項目ごとに差分同期。項目の省略 = 維持、[] = 全部消す。戻り値に書いた値の配列を載せる
// - minItems: create の項目の省略は [] とみなして検査（DB に触れる前に 400。複製の内側の主の create は印で飛ばす）。
//   upsert で項目を省けば、主の書き込みの後に同じ TX で従属の件数を数え、下限未満なら 400（巻き戻る）。
//   minItems を宣言しない（または 0 の）項目だけのサービスは今の経路のまま（TX もクエリも増えない）
// - bulkUpsert / bulkUpdate / bulkUpdateByIds / bulkUpdateByQuery / replaceByQuery: 集まりの値
//   （[] を含む）が入っていれば DB を変える前に 400。値が無ければ今のまま
// - 読み出しの 7 口（get / getWithDeleted / list / listWithDeleted / search / searchWithDeleted /
//   searchForSorting）: 返した主の行に、集まりごとに値の配列を全件（件数の上限なし）並び順で載せる。
//   集まり 1 つにつき呼び出し 1 回で 1 クエリ（主の id の IN）。従属が無ければ []。restore / reorder /
//   systemUpdate / bulk 系の戻り値には載せない（省略 = 維持なので保存しても失わない）
// - 他ドメインの withRelations で埋め込まれた主の行: 表の登録（tableCollections.ts）からリレーション展開が同じ射影で載せる
// - collectionFields: 集まりの項目名を読み取り専用で出す（dataMigration の拒否・書き出しの除外が使う）
// - duplicate / duplicateWithIdMap: applyCollectionDuplicate が storage binding の外側で包み、
//   duplicateWithCollections（2 段の複製）を呼ぶ
// - 呼び出し元が tx を渡さなければ内部で TX を張る（従属の hardDelete のファイルの片付けは従属の
//   storage binding の動きのまま: 外から tx を渡すので掃除 cron が片付ける）

import { count, eq, getTableColumns } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";

import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors";
import type { ReplaceByQueryOptions, WhereExpr } from "@/lib/crud/types";

import type { DbTransaction } from "../drizzle/types";
import type { DuplicateOptions } from "@/lib/crud/types";

import { collectionEntriesForParents } from "./collectionEntries";
import { duplicateWithCollections } from "./duplicateWithCollections";
import { projectCollections } from "./projectCollections";
import { SKIP_OMITTED_MIN_ITEMS } from "./internalMarkers";
import { minItemsError, resolveCollectionColumns, syncCollectionInTx, validateCollectionValues } from "./syncCollection";
import { registerTableCollections } from "./tableCollections";
import type { CollectionDuplicateParentService, CollectionFieldsAugmented, CollectionValue, CrudCollectionConfig } from "./types";

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
): TService & Required<CollectionFieldsAugmented> {
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
  // 他ドメインの withRelations で埋め込まれたこの表の行にも集まりを載せる（tableCollections.ts）
  registerTableCollections(table, collections);

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
    delete (rest as Record<PropertyKey, unknown>)[SKIP_OMITTED_MIN_ITEMS];
    collections.forEach((collection, index) => {
      if (!hasOwn.call(rest, collection.fieldName)) return;
      const value = rest[collection.fieldName];
      delete rest[collection.fieldName];
      if (value !== undefined) values.set(index, validateCollectionValues(collection, value));
    });
    return { rest, values };
  };

  /** minItems が 1 以上で、入力に値の無い（省略した）項目の添字 */
  const omittedRequired = (values: Map<number, CollectionValue[]>): number[] =>
    collections.flatMap((collection, index) => ((collection.minItems ?? 0) >= 1 && !values.has(index) ? [index] : []));

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

  /** 主の行に集まりの値の配列を載せる（集まりごとに 1 クエリ、件数の上限なし。埋め込みの射影と共通） */
  const project = (records: readonly Row[]): Promise<void> => projectCollections(records, collections, resolved);

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

  /** 集まりの宣言を項目名で引く（無ければ 404） */
  const collectionOf = (fieldName: string): CrudCollectionConfig => {
    const collection = collections.find((item) => item.fieldName === fieldName);
    if (!collection) throw new DomainError(`集まりの項目 ${fieldName} はありません`, { status: 404 });
    return collection;
  };

  /** エントリ（従属の行 id 付き）で読む。論理削除された主のエントリは返さない */
  const entriesForParents = async (fieldName: string, parentIds: readonly (string | number)[]) => {
    const entries = await collectionEntriesForParents({ collection: collectionOf(fieldName), parentTable: table, parentIds });
    return Object.fromEntries([...entries].map(([id, list]) => [String(id), list]));
  };

  const wrapped: TService & Required<CollectionFieldsAugmented> = {
    ...service,

    collectionFields: Object.freeze([...fieldNames]),

    async collectionEntries(fieldName, parentId) {
      return (await entriesForParents(fieldName, [parentId]))[String(parentId)] ?? [];
    },

    collectionEntriesForParents: entriesForParents,

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
      const skipOmitted = Boolean(data && typeof data === "object" && (data as Record<PropertyKey, unknown>)[SKIP_OMITTED_MIN_ITEMS]);
      const { rest, values } = separate(data);
      // 項目の省略は [] とみなす（minItems が 1 以上なら必ず 400。DB に触れる前）
      if (!skipOmitted) {
        for (const index of omittedRequired(values)) validateCollectionValues(collections[index], []);
      }
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
      // 新規か更新かは書くまで分からないので、省いた必須の項目は書いた後に従属の件数で検査する
      const omitted = omittedRequired(values);
      if (!values.size && !omitted.length) return service.upsert(rest, upsertOptions, tx);
      return runInTx(tx, async (executor) => {
        const upserted = await service.upsert(rest, upsertOptions, executor);
        if (!upserted) return upserted;
        await syncAll(executor, upserted as Row, values);
        for (const index of omitted) {
          const collection = collections[index];
          const [{ total }] = await executor
            .select({ total: count() })
            .from(resolved[index].childTable as any)
            .where(eq(collection.parentColumn, (upserted as Row).id as CollectionValue));
          if (total < (collection.minItems ?? 0)) throw minItemsError(collection);
        }
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
