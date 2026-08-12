// src/lib/crud/drizzle/hiddenColumns.ts
//
// 秘匿カラム（hidden columns）: サービス境界の外に決して出してはならないカラムを
// テーブル定義レベルで宣言する仕組み。
//
// - 宣言場所: entities/drizzle.ts のテーブル定義直後に defineHiddenColumns() を呼ぶ。
//   テーブルオブジェクトを参照するあらゆるコード（サービス・リレーション展開）から
//   確実に参照できるため、import 順序に依存しない（fail-closed）。
// - 効果: createCrudService の全メソッドの戻り値、および他ドメインの
//   withRelations 展開で埋め込まれる行からも、宣言カラムが null に置換される。
// - 秘匿値をサーバー内部で読む必要がある場合（パスワード検証等）は、
//   createCrudService を経由しない専用ファインダー（直接 drizzle 読み取り）を
//   ドメインの services/server/finders/ に作ること。汎用サービス経由では読めない。
//
// このモジュールは entities/drizzle.ts から import されるため、
// 依存は drizzle-orm のみに限定する（@/lib/drizzle への循環 import を避ける）。

import { getTableColumns } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

/** テーブルオブジェクト → 秘匿カラム（プロパティ名）集合 */
const hiddenColumnsRegistry = new WeakMap<object, Set<string>>();

/**
 * テーブルの秘匿カラムを宣言する。entities/drizzle.ts のテーブル定義直後に呼ぶこと。
 * プロパティ名（camelCase）で指定する。存在しない名前は定義時に即 throw（fail-fast）。
 */
export function defineHiddenColumns(table: PgTable, props: readonly string[]): void {
  const columnProps = new Set(Object.keys(getTableColumns(table)));
  for (const prop of props) {
    if (!columnProps.has(prop)) {
      throw new Error(`defineHiddenColumns: unknown column property "${prop}"`);
    }
  }
  hiddenColumnsRegistry.set(table, new Set(props));
}

/** テーブルに宣言された秘匿カラム集合を返す（未宣言なら undefined） */
export function getHiddenColumnProps(table: object): ReadonlySet<string> | undefined {
  return hiddenColumnsRegistry.get(table);
}

/**
 * 行配列から対象テーブルの秘匿カラムを null に置換する（in-place）。
 * リレーション展開など「他テーブルの行を埋め込む」箇所で、埋め込み前に呼ぶ。
 */
export function stripHiddenColumnsForTable(
  table: object,
  records: Array<Record<string, unknown> | null | undefined>,
): void {
  const hidden = hiddenColumnsRegistry.get(table);
  if (!hidden?.size) return;
  for (const record of records) {
    if (!record) continue;
    for (const prop of hidden) {
      if (prop in record && record[prop] != null) {
        record[prop] = null;
      }
    }
  }
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/**
 * 戻り値グラフを再帰的に走査し、秘匿カラム名に一致するキーを null に置換する。
 * PaginatedResult / bulk 系 / リレーション展開済みネスト行など、戻り形状に
 * 依存せず適用できる（新メソッド追加時も自動でカバーされる fail-closed 設計）。
 * plain object と配列のみ走査する（Date / SQL 式などのクラスインスタンスは対象外）。
 */
function stripDeep(value: unknown, hidden: ReadonlySet<string>, seen: WeakSet<object>): void {
  if (Array.isArray(value)) {
    if (seen.has(value)) return;
    seen.add(value);
    for (const item of value) stripDeep(item, hidden, seen);
    return;
  }
  if (!isPlainObject(value)) return;
  if (seen.has(value)) return;
  seen.add(value);
  for (const key of Object.keys(value)) {
    if (hidden.has(key)) {
      if (value[key] != null) value[key] = null;
    } else {
      stripDeep(value[key], hidden, seen);
    }
  }
}

/**
 * サービスの全メソッドをラップし、戻り値から秘匿カラムを除去する。
 * createCrudService の最終段で適用する（audit / requestMemo は生の値で動作した後、
 * 呼び出し元へ返る直前に置換される）。
 * テーブルに秘匿カラムの宣言がなければサービスをそのまま返す（コストゼロ）。
 */
export function applyHiddenColumns<S extends Record<string, unknown>>(
  service: S,
  table: object,
): S {
  const hidden = hiddenColumnsRegistry.get(table);
  if (!hidden?.size) return service;

  const decorated = { ...service } as Record<string, unknown>;
  for (const [name, member] of Object.entries(service)) {
    if (typeof member !== "function") continue;
    const original = member as (...args: unknown[]) => unknown;
    decorated[name] = (...args: unknown[]) => {
      const result = original.apply(decorated, args);
      if (result instanceof Promise) {
        return result.then((resolved) => {
          stripDeep(resolved, hidden, new WeakSet());
          return resolved;
        });
      }
      // 同期メソッド（invalidateRequestMemo / getTableName 等）は素通し
      return result;
    };
  }
  return decorated as S;
}
