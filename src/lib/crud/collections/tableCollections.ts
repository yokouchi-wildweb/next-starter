// src/lib/crud/collections/tableCollections.ts
//
// 表 → 集まりの宣言（collections オプション）の登録。他ドメインの withRelations で主の行が埋め込まれたとき、
// 埋め込む側のサービスは主のサービスを読まないので、表のオブジェクトから主の集まりを引けるようにする。
// - 宣言場所: 主の entities/drizzle.ts の表の定義の後に defineTableCollections()（生成器が出す）。
//   表のオブジェクトを参照するコード（リレーション展開）から import 順に依らず引ける（hiddenColumns.ts と同じ前例）。
//   collections.ts は従属の表を import し、従属の表は主の表を参照するので、宣言は遅延 import で渡す（循環を避ける）
// - 主のサービス（applyCollections）も生成時に登録する（entities/drizzle.ts を手書きする主も、サービスが読まれていれば引ける）
//
// このモジュールは entities/drizzle.ts から import されるため、依存は型だけにする（@/lib/drizzle への循環 import を避ける）。

import type { CrudCollectionConfig } from "./types";

type CollectionsLoader = () => Promise<readonly CrudCollectionConfig[]>;

type Entry = {
  configs?: readonly CrudCollectionConfig[];
  loader?: CollectionsLoader;
  loading?: Promise<readonly CrudCollectionConfig[]>;
};

/** 表のオブジェクト → 集まりの宣言 */
const registry = new WeakMap<object, Entry>();

const entryOf = (table: object): Entry => {
  const existing = registry.get(table);
  if (existing) return existing;
  const entry: Entry = {};
  registry.set(table, entry);
  return entry;
};

/**
 * 表の集まりの宣言を遅延で登録する。主の entities/drizzle.ts の表の定義の後に呼ぶ（生成器が出す）。
 * @example defineTableCollections(SampleTable, () => import("@/features/sample/services/server/collections").then((m) => m.collections));
 */
export function defineTableCollections(table: object, loader: CollectionsLoader): void {
  entryOf(table).loader = loader;
}

/** 表の集まりの宣言をすぐに登録する（applyCollections がサービス生成時に呼ぶ） */
export function registerTableCollections(table: object, configs: readonly CrudCollectionConfig[]): void {
  entryOf(table).configs = configs;
}

/** 表に集まりの登録があるか（無ければ埋め込みは何もしない = クエリも増えない） */
export function hasTableCollections(table: object): boolean {
  const entry = registry.get(table);
  return Boolean(entry && (entry.configs?.length || entry.loader));
}

/** 表の集まりの宣言（遅延の登録は最初の 1 回だけ読み込み、以後は同じ値）。登録が無ければ null */
export async function getTableCollections(table: object): Promise<readonly CrudCollectionConfig[] | null> {
  const entry = registry.get(table);
  if (!entry) return null;
  if (entry.configs) return entry.configs;
  if (!entry.loader) return null;
  entry.loading ??= entry.loader().then((configs) => {
    entry.configs = configs;
    return configs;
  });
  return entry.loading;
}
