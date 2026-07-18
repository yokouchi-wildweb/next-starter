// src/lib/crud/drizzle/requestMemo.ts

import { createRequestMemo } from "@/lib/requestMemo";

/**
 * 完了時にリクエストスコープメモを全破棄する書き込み系メソッド名。
 * createCrudService が返すサービスのうち、テーブルの行を変更し得るものを列挙する。
 * サービスに存在しないメソッド名（オプション未指定で生成されない conditional 系）は無視される。
 */
const WRITE_METHOD_NAMES = [
  "create",
  "update",
  "remove",
  "restore",
  "hardDelete",
  "upsert",
  "duplicate",
  "reorder",
  "initializeSortOrder",
  // searchForSorting は NULL sort_order の自動初期化で書き込みが発生し得る
  "searchForSorting",
  "bulkDeleteByIds",
  "bulkDeleteByQuery",
  "bulkHardDeleteByIds",
  "bulkUpdateByIds",
  "bulkUpdate",
  "bulkUpsert",
  "truncateAll",
] as const;

export type RequestMemoAugmented = {
  /**
   * get のリクエストスコープメモを手動で全破棄する。
   * createCrudService を経由せず生SQL（db.update(Table) 等）でこのテーブルを
   * 書き込んだ直後に必ず呼ぶこと。requestMemo が無効なサービスでは no-op。
   */
  invalidateRequestMemo: () => void;
};

type AnyAsyncFn = (...args: unknown[]) => Promise<unknown>;

/**
 * サービスに requestMemo（リクエストスコープメモ化）を適用する。
 *
 * - get(id): オプションなし呼び出しのみ id キーでメモ化する。WithOptions 付きは
 *   リレーション展開で戻り形状が変わるため素通しする。
 * - 書き込みメソッド: 成否にかかわらず完了時にメモを全破棄する（部分書き込みや
 *   同一トランザクション内の後続読み取りを安全側に扱うため）。
 * - invalidate はメソッドの return 時点で発火する。外側トランザクションのコミットを
 *   待たないため、tx 内の読み取りは tx executor 経由で行う既存原則を守ること。
 */
export function applyRequestMemo<
  S extends { get: (id: string, options?: never) => Promise<unknown> },
>(service: S, enabled: boolean): S & RequestMemoAugmented {
  if (!enabled) {
    return { ...service, invalidateRequestMemo: () => {} };
  }

  const rawGet = service.get as unknown as (
    id: string,
    options?: unknown,
  ) => Promise<unknown>;
  const memo = createRequestMemo((id: string) => rawGet.call(service, id));

  const decorated = { ...service } as S & RequestMemoAugmented;
  const mutable = decorated as unknown as Record<string, unknown>;

  mutable.get = (id: string, options?: unknown) =>
    options === undefined ? memo.read(id) : rawGet.call(decorated, id, options);

  for (const name of WRITE_METHOD_NAMES) {
    const original = (service as unknown as Record<string, unknown>)[name];
    if (typeof original !== "function") continue;
    mutable[name] = async (...args: unknown[]) => {
      try {
        return await (original as AnyAsyncFn).apply(decorated, args);
      } finally {
        memo.invalidateAll();
      }
    };
  }

  decorated.invalidateRequestMemo = memo.invalidateAll;
  return decorated;
}
