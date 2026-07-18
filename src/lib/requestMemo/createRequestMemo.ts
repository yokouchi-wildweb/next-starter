// src/lib/requestMemo/createRequestMemo.ts

import { cache } from "react";

export type RequestMemoOptions<Args extends unknown[]> = {
  /** 引数からメモ化キーを導出する。省略時は第一引数を String() した値 */
  key?: (...args: Args) => string;
  /** true を返した呼び出しはメモ化せず素通しする（オプション付き呼び出し等） */
  shouldBypass?: (...args: Args) => boolean;
};

export type RequestMemo<Args extends unknown[], Result> = {
  /** メモ化された読み取り。同一リクエスト内の同一キーは元関数を1回しか呼ばない */
  read: (...args: Args) => Promise<Result>;
  /** 指定キーのメモを破棄する */
  invalidate: (key: string) => void;
  /** 全キーのメモを破棄する。対象テーブルへの書き込み直後に呼ぶ */
  invalidateAll: () => void;
};

/**
 * リクエストスコープの「無効化できる」メモ化を作る。
 *
 * React の cache() を「関数のメモ化」にではなく「リクエストスコープの可変ストア取得」
 * に使う点がポイント。cache(fn) の素のラップと違い、ストアが Map であるため
 * 書き込み側から invalidate でき、同一リクエスト内の read-your-writes を保てる。
 *
 * - リクエストスコープ内（RSC / Route Handler）: 同一リクエストは常に同じ Map を
 *   共有し、同一キーの読み取りは1回に圧縮される。
 * - リクエストスコープ外（cron / CLI / スクリプト）: cache() が素通しになり毎回
 *   新しい Map が返るため、メモ化されず常に素の呼び出しになる（安全側に退化）。
 *
 * 注意:
 * - 同一リクエスト内の複数の呼び出し元は同じ結果オブジェクト参照を共有する。
 *   返却値を直接ミューテートしないこと。
 * - reject された Promise はキャッシュに残さない（次の呼び出しで再試行される）。
 * - 並行呼び出しは in-flight の Promise を共有する（同時多重発行も1回に圧縮）。
 */
export function createRequestMemo<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  options: RequestMemoOptions<Args> = {},
): RequestMemo<Args, Result> {
  const getStore = cache(() => new Map<string, Promise<Result>>());
  const keyOf = options.key ?? ((...args: Args) => String(args[0]));

  return {
    async read(...args: Args): Promise<Result> {
      if (options.shouldBypass?.(...args)) return fn(...args);
      const store = getStore();
      const key = keyOf(...args);
      const hit = store.get(key);
      if (hit) return hit;
      const promise = fn(...args);
      store.set(key, promise);
      try {
        return await promise;
      } catch (error) {
        // 失敗はキャッシュしない
        store.delete(key);
        throw error;
      }
    },
    invalidate(key: string): void {
      getStore().delete(key);
    },
    invalidateAll(): void {
      getStore().clear();
    },
  };
}
