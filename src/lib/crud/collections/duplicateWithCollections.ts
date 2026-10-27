// src/lib/crud/collections/duplicateWithCollections.ts
//
// 集まりを持つ主の複製の単独関数（2 段）。createCrudService の duplicate / duplicateWithIdMap はこれを呼ぶ。
// base の duplicate を通らない呼び出し（手書きのドメイン・fork の独自の複製）からも同じ規則で使える。
// - 1 段目（TX の外）: 複製元の主を読み、主と従属のファイルの列を各サービスの storage binding で新しい ref に
//   写す（duplicateStorageValues。binding の無いサービスは値をそのまま写す）。1 件でも失敗すれば throw し、
//   DB には何も書かない（複製元はそのまま）
// - 2 段目（1 つの TX。呼び出し元の tx があればそれ）: 集まりの項目を外して主を作り（get が載せた配列を
//   主の create に流さない）、従属を複製元の並び順に従属のサービスの create で作る（id・主への参照・並び
//   以外の列と、写したファイルの値）。並びは同期と同じく列の型で振り直し、systemUpdate で書く
// - 集まりの宣言の duplicate: false の項目は写さない（複製した主の集まりは空）
// - 2 段目が巻き戻ると、1 段目で写したファイルは未紐付けのまま残り、掃除 cron が回収する

import { eq } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import { buildDuplicateData } from "../drizzle/utils";
import type { DbTransaction } from "../drizzle/types";
import { collectionOrderBy } from "./collectionOrder";
import { resolveCollectionColumns, writeCollectionSort } from "./syncCollection";
import type {
  CollectionDuplicateResult,
  CollectionValue,
  CrudCollectionChildService,
  CrudCollectionConfig,
  DuplicateWithCollectionsParams,
} from "./types";

type Row = Record<string, unknown>;

type ChildPlan = {
  collection: CrudCollectionConfig;
  resolved: ReturnType<typeof resolveCollectionColumns>;
  child: CrudCollectionChildService | null;
  /** 複製元の従属の行（並び順）と、写したファイルの値 */
  rows: { source: Row; copied: Row }[];
};

/** 従属の行から、新しい行の入力を作る（id・主への参照・並び・作成/更新日時を外し、写したファイルの値を重ねる） */
function childInput(plan: ChildPlan, source: Row, copied: Row): Row {
  const { parentProp, sortProp } = plan.resolved;
  const input: Row = { ...source, ...copied };
  for (const key of ["id", parentProp, sortProp, "createdAt", "updatedAt"]) delete input[key];
  return input;
}

/**
 * 主の 1 行を、集まりの従属ごと 2 段で複製する。tx を渡さなければ 2 段目で内部の TX を張る。
 * 複製元が無ければ throw（duplicate と同じ）。
 */
export async function duplicateWithCollections<T = Row>(
  params: DuplicateWithCollectionsParams,
  tx?: DbTransaction,
): Promise<CollectionDuplicateResult<T>> {
  const { service, collections, id, options } = params;

  // ---- 1 段目（TX の外）: 読む・ファイルを写す ----
  const record = (await service.get(id)) as Row | undefined;
  if (!record) {
    throw new Error(`Record not found: ${id}`);
  }
  const parentCopied = (await service.duplicateStorageValues?.(record)) ?? {};

  const plans: ChildPlan[] = [];
  for (const collection of collections) {
    const resolved = resolveCollectionColumns(collection);
    if (collection.duplicate === false) {
      plans.push({ collection, resolved, child: null, rows: [] });
      continue;
    }
    const sources = (await db
      .select()
      .from(resolved.childTable as any)
      .where(eq(collection.parentColumn, record.id as CollectionValue))
      .orderBy(...collectionOrderBy(collection, resolved))) as Row[];
    const child = await collection.service();
    const rows: ChildPlan["rows"] = [];
    for (const source of sources) {
      rows.push({ source, copied: (await child.duplicateStorageValues?.(source)) ?? {} });
    }
    plans.push({ collection, resolved, child, rows });
  }

  // ---- 2 段目（1 つの TX）: 主と従属を作る ----
  const newData: Row = { ...buildDuplicateData(record, options), ...parentCopied };
  for (const collection of collections) delete newData[collection.fieldName];

  const write = async (executor: DbTransaction): Promise<CollectionDuplicateResult<T>> => {
    const created = (await service.create(newData, executor)) as Row;
    const idMaps: CollectionDuplicateResult["idMaps"] = {};
    for (const plan of plans) {
      const { collection, resolved, child, rows } = plan;
      const idMap = new Map<string | number, string | number>();
      const newValues: CollectionValue[] = [];
      if (child) {
        const sorts = resolved.sortValues(rows.length);
        for (const [index, { source, copied }] of rows.entries()) {
          const sort = sorts[index];
          const inserted = (await child.create(
            { ...childInput(plan, source, copied), [resolved.parentProp]: created.id, [resolved.sortProp]: sort },
            executor,
          )) as Row;
          // 並びは create の入力にも入れるが、従属の parseCreate が落とすことがあるので同期と同じく必ず書く
          const written = await writeCollectionSort(executor, child, collection, resolved, inserted, sort);
          idMap.set(source.id as string | number, written.id as string | number);
          newValues.push(written[resolved.valueProp] as CollectionValue);
        }
      }
      idMaps[collection.fieldName] = idMap;
      created[collection.fieldName] = newValues;
    }
    return { record: created as T, idMaps };
  };

  if (tx) return write(tx);
  return db.transaction((innerTx) => write(innerTx));
}
