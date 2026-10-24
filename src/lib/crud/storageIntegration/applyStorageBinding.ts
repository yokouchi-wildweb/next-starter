// src/lib/crud/storageIntegration/applyStorageBinding.ts
//
// createCrudService の `storage` オプションの実装。書き込み系メソッドを包み、業務行の書き込みと
// 同じ TX の中で binding（台帳への紐付け・解除）を呼ぶ。storage を指定しないサービスには適用しない。
// - create / update / upsert: 書いた直後に afterWrite（update / upsert は書く前の行を FOR UPDATE で読む）
// - 物理削除（hardDelete と、soft delete を使わない表の remove / bulkDeleteByIds / bulkDeleteByQuery）: afterHardDelete
// - soft delete・restore: 何もしない（restore で戻せるように紐付けを残す）
// - replaceByQuery: 対象の旧行を FOR UPDATE で読み、置き換えた直後に afterReplace（旧行全体と新しい行全体の差分）。
//   afterReplace の無い binding では DomainError（台帳を通らない置き換えをさせない）
// - duplicate: TX の外で先に duplicateValues（複製）→ 新しい行の create（そこで紐付け）
// - bulkUpdate* / bulkUpsert: メディア列を変える呼び出しは DomainError（行ごとの差分計算は初版の範囲外）
// - storageFields: binding の列の宣言をそのまま読み取り専用で出す（dataMigration がメディア列を知る正本）
// - storageCascadeForeignKeys: 親の削除で DB が行を消す FK（onDelete cascade）。binding を通らないので空であるべき
// - 呼び出し元が tx を渡さなければ内部で TX を張り、commit 後に afterCommit で実物を片付ける。
//   tx を渡された場合は外側の TX がまだ commit されていないので片付けず、掃除 cron に任せる

import { eq, getTableColumns, inArray, and, type SQL } from "drizzle-orm";
import { getTableConfig, type AnyPgColumn, type PgTable } from "drizzle-orm/pg-core";

import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors";
import type { DuplicateOptions, ReplaceByQueryOptions, UpsertOptions, WhereExpr } from "@/lib/crud/types";

import type { DbTransaction } from "../drizzle/types";
import { buildWhere } from "../drizzle/query";
import { buildDuplicateData } from "../drizzle/utils";
import type { CrudStorageBinding, CrudStorageCleanup, CrudStorageField } from "./types";

type Row = Record<string, unknown>;

type StorageBindingAugmented = {
  readonly storageFields: readonly CrudStorageField[];
  readonly storageCascadeForeignKeys: readonly string[];
};

/** この表から親へ向かう FK のうち onDelete cascade のもの（`<列名> → <参照先の表>`） */
function cascadeForeignKeysOf(table: PgTable): string[] {
  return getTableConfig(table)
    .foreignKeys.filter((foreignKey) => foreignKey.onDelete === "cascade")
    .map((foreignKey) => {
      const reference = foreignKey.reference();
      const columns = reference.columns.map((column) => column.name).join(", ");
      return `${columns} → ${getTableConfig(reference.foreignTable).name}`;
    });
}

type ApplyStorageBindingContext = {
  table: PgTable & { id: AnyPgColumn };
  binding: CrudStorageBinding;
  /** true = remove / bulkDelete* は論理削除（ファイルを残す） */
  useSoftDelete: boolean;
  /** upsert の衝突対象の列（createCrudService の resolveConflictTarget） */
  conflictTarget: (upsertOptions?: UpsertOptions<any>) => AnyPgColumn | AnyPgColumn[];
};

type StorageAwareService = {
  create(data: any, tx?: DbTransaction): Promise<any>;
  update(id: string, data: any, tx?: DbTransaction): Promise<any>;
  upsert(data: any, upsertOptions?: any, tx?: DbTransaction): Promise<any>;
  remove(id: string, tx?: DbTransaction): Promise<void>;
  hardDelete(id: string, tx?: DbTransaction): Promise<void>;
  bulkDeleteByIds(ids: string[], tx?: DbTransaction): Promise<void>;
  bulkDeleteByQuery(where: WhereExpr, tx?: DbTransaction): Promise<void>;
  bulkUpdateByIds(ids: string[], data: any, tx?: DbTransaction): Promise<any>;
  bulkUpdateByQuery(where: WhereExpr, data: any, tx?: DbTransaction): Promise<any>;
  bulkUpdate(records: { id: string; data: any }[], tx?: DbTransaction): Promise<any>;
  bulkUpsert(records: any[], options?: any, tx?: DbTransaction): Promise<any>;
  replaceByQuery(where: WhereExpr, records: any[], replaceOptions?: ReplaceByQueryOptions, tx?: DbTransaction): Promise<any[]>;
  duplicate(id: string, options?: DuplicateOptions, tx?: DbTransaction): Promise<any>;
  get(id: string): Promise<any>;
};

export function applyStorageBinding<TService extends StorageAwareService>(
  service: TService,
  context: ApplyStorageBindingContext,
): TService & StorageBindingAugmented {
  const { table, binding, useSoftDelete } = context;
  const idColumn = table.id;
  const fieldNames = binding.fields.map((field) => field.name);
  let columnKeys: Map<AnyPgColumn, string> | undefined;
  const columnKeyOf = (column: AnyPgColumn): string | undefined => {
    columnKeys ??= new Map(
      Object.entries(getTableColumns(table)).map(([key, value]) => [value as AnyPgColumn, key]),
    );
    return columnKeys.get(column);
  };

  const touchesStorage = (data: unknown): boolean =>
    Boolean(data) &&
    typeof data === "object" &&
    fieldNames.some((name) => (data as Row)[name] !== undefined);

  const rejectBulkWrite = (operation: string): never => {
    throw new DomainError(
      `${operation} ではファイルの列（${fieldNames.join(", ")}）を変更できません。行ごとに update を使ってください`,
      { status: 400 },
    );
  };

  /** binding を呼ぶ TX を用意する。tx を渡されなければ内部で張り、commit 後に片付ける */
  const runInTx = async <T>(
    tx: DbTransaction | undefined,
    work: (executor: DbTransaction) => Promise<{ result: T; cleanups: CrudStorageCleanup[] }>,
  ): Promise<T> => {
    if (tx) return (await work(tx)).result;
    const { result, cleanups } = await db.transaction((innerTx) => work(innerTx));
    await binding.afterCommit(cleanups);
    return result;
  };

  const lockRows = async (executor: DbTransaction, where: SQL | undefined): Promise<Row[]> =>
    (await executor.select().from(table as any).where(where).for("update")) as Row[];

  /** upsert の衝突対象の値から、書く前の行を探す（値が欠けていれば新規 = null） */
  const lockUpsertTarget = async (
    executor: DbTransaction,
    data: Row,
    upsertOptions: UpsertOptions<any> | undefined,
  ): Promise<Row | null> => {
    const target = context.conflictTarget(upsertOptions);
    const columns = Array.isArray(target) ? target : [target];
    const conditions: SQL[] = [];
    for (const column of columns) {
      const key = columnKeyOf(column);
      const value = key ? data[key] : undefined;
      if (value === undefined || value === null) return null;
      conditions.push(eq(column, value));
    }
    return (await lockRows(executor, and(...conditions)))[0] ?? null;
  };

  const hardDeleteWith = async (
    tx: DbTransaction | undefined,
    where: SQL | undefined,
    remove: (executor: DbTransaction) => Promise<void>,
  ): Promise<void> =>
    runInTx(tx, async (executor) => {
      const rows = await lockRows(executor, where);
      await remove(executor);
      const cleanup = rows.length ? await binding.afterHardDelete(executor, rows) : null;
      return { result: undefined, cleanups: [cleanup] };
    });

  const wrapped: TService & StorageBindingAugmented = {
    ...service,

    storageFields: binding.fields,

    get storageCascadeForeignKeys() {
      return binding.onHardDelete === "keep" ? [] : cascadeForeignKeysOf(table);
    },

    async create(data, tx) {
      return runInTx(tx, async (executor) => {
        const created = await service.create(data, executor);
        const cleanup = await binding.afterWrite(executor, null, created as Row);
        return { result: created, cleanups: [cleanup] };
      });
    },

    async update(id, data, tx) {
      // メディア列に触れない更新は値が変わらないので、台帳の連動も要らない
      if (!touchesStorage(data)) return service.update(id, data, tx);
      return runInTx(tx, async (executor) => {
        const before = (await lockRows(executor, eq(idColumn, id)))[0] ?? null;
        const updated = await service.update(id, data, executor);
        const cleanup = updated ? await binding.afterWrite(executor, before, updated as Row) : null;
        return { result: updated, cleanups: [cleanup] };
      });
    },

    async upsert(data, upsertOptions, tx) {
      return runInTx(tx, async (executor) => {
        const before = await lockUpsertTarget(executor, data as Row, upsertOptions);
        const upserted = await service.upsert(data, upsertOptions, executor);
        const cleanup = upserted ? await binding.afterWrite(executor, before, upserted as Row) : null;
        return { result: upserted, cleanups: [cleanup] };
      });
    },

    async remove(id, tx) {
      if (useSoftDelete) return service.remove(id, tx);
      return hardDeleteWith(tx, eq(idColumn, id), (executor) => service.remove(id, executor));
    },

    async hardDelete(id, tx) {
      return hardDeleteWith(tx, eq(idColumn, id), (executor) => service.hardDelete(id, executor));
    },

    async bulkDeleteByIds(ids, tx) {
      if (useSoftDelete || ids.length === 0) return service.bulkDeleteByIds(ids, tx);
      return hardDeleteWith(tx, inArray(idColumn, ids), (executor) => service.bulkDeleteByIds(ids, executor));
    },

    async bulkDeleteByQuery(where, tx) {
      if (useSoftDelete || !where) return service.bulkDeleteByQuery(where, tx);
      return hardDeleteWith(tx, buildWhere(table, where), (executor) => service.bulkDeleteByQuery(where, executor));
    },

    async bulkUpdateByIds(ids, data, tx) {
      if (touchesStorage(data)) rejectBulkWrite("bulkUpdateByIds");
      return service.bulkUpdateByIds(ids, data, tx);
    },

    async bulkUpdateByQuery(where, data, tx) {
      if (touchesStorage(data)) rejectBulkWrite("bulkUpdateByQuery");
      return service.bulkUpdateByQuery(where, data, tx);
    },

    async bulkUpdate(records, tx) {
      if (records.some((record) => touchesStorage(record.data))) rejectBulkWrite("bulkUpdate");
      return service.bulkUpdate(records, tx);
    },

    async bulkUpsert(records, options, tx) {
      if (records.some((record) => touchesStorage(record))) rejectBulkWrite("bulkUpsert");
      return service.bulkUpsert(records, options, tx);
    },

    async replaceByQuery(where, records, replaceOptions, tx) {
      const { afterReplace } = binding;
      if (!afterReplace) {
        throw new DomainError(
          `replaceByQuery はファイルの列（${fieldNames.join(", ")}）を持つ表では使えません（binding が afterReplace に対応していません）`,
          { status: 400 },
        );
      }
      // where 無しは本体が throw する。論理削除の表で records がメディア列に触れなければ、台帳は何も変わらない
      if (!where || (useSoftDelete && !records.some((record) => touchesStorage(record)))) {
        return service.replaceByQuery(where, records, replaceOptions, tx);
      }
      return runInTx(tx, async (executor) => {
        const before = await lockRows(executor, buildWhere(table, where));
        const inserted = await service.replaceByQuery(where, records, replaceOptions, executor);
        const cleanup = await afterReplace.call(binding, executor, before, inserted as Row[], {
          softDeleted: useSoftDelete,
        });
        return { result: inserted, cleanups: [cleanup] };
      });
    },

    async duplicate(id, options, tx) {
      const record = await service.get(id);
      if (!record) {
        throw new Error(`Record not found: ${id}`);
      }
      // 複製は長い業務 TX の外で先に済ませる。1 件でも失敗すれば throw して複製全体を失敗にする（元行はそのまま）
      const copiedValues = await binding.duplicateValues(record as Row);
      const newData = { ...buildDuplicateData(record as Row, options), ...copiedValues };
      return wrapped.create(newData, tx);
    },
  };

  return wrapped;
}
