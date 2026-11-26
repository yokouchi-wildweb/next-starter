// src/lib/cacheTags/context.ts — キャッシュタグを集める範囲(node の AsyncLocalStorage)。server だけが読む(入口 ./server)

import { AsyncLocalStorage } from "node:async_hooks";
import { revalidateTag } from "next/cache";

/**
 * 書き込みの要求の範囲で「捨てるキャッシュタグ(タグ)」を集め、要求の終わりにまとめて捨てる。
 *
 * - 書き込みの側(CRUD の書き込み・手の書き込み)は `markCacheTags(...)` を呼ぶだけ。DB にも Next にも触れない
 * - 入口(route factory など)が `runWithCacheTags(fn)` で包み、fn の後に集めたキャッシュタグを
 *   `revalidateTag(tag, { expire: 0 })` へ渡す(次の読みが待って読み直す = 書いた直後に古い値を返さない)
 * - 範囲の外(pnpm task・起動時・test)では捨てられない(revalidateTag は Next の要求の中だけ)。
 *   投げずに数えて 1 行記録する。永続の再送は持たない
 */
type CacheTagStore = { tags: Set<string> };

const cacheTagStore = new AsyncLocalStorage<CacheTagStore>();

/** キャッシュタグを捨てる関数。既定は next/cache の revalidateTag(tag, { expire: 0 })。test が差し替える */
export type RevalidateTag = (tag: string) => void | Promise<void>;

export type RunWithCacheTagsDeps = {
  revalidate?: RevalidateTag;
};

/** 失敗の記録に載せるキャッシュタグの数の上限(頭から) */
const LOGGED_TAGS = 5;

const defaultRevalidate: RevalidateTag = (tag) => {
  revalidateTag(tag, { expire: 0 });
};

/** 範囲の外で印が付けられた回数(この process の中、記録の行に載せる) */
let untrackedCount = 0;

/**
 * 今の要求の範囲にキャッシュタグを積む(同じキャッシュタグは 1 つ)。空のキャッシュタグは無視する。
 * 範囲の外では投げずに数えて記録の 1 行(console.warn の JSON)を出す。
 */
export function markCacheTags(...tags: string[]): void {
  const marked = tags.filter((tag) => tag);
  if (marked.length === 0) return;

  const store = cacheTagStore.getStore();
  if (!store) {
    untrackedCount += 1;
    console.warn(
      JSON.stringify({
        event: "cache tags not revalidated outside a request",
        lib: "cacheTags",
        count: untrackedCount,
        tags: marked.slice(0, LOGGED_TAGS),
        tagCount: marked.length,
      }),
    );
    return;
  }

  for (const tag of marked) store.tags.add(tag);
}

/**
 * キャッシュタグを集める範囲を敷いて `fn` を走らせ、終わりに(成功でも throw でも)集めたキャッシュタグをまとめて捨てる。
 * - throw でも捨てる: 書き込みが途中で確定していても古い値を残さない(余分に捨てるのは無害)
 * - 既に範囲の中なら新しい範囲を敷かず外側に積む(捨てるのは外側の終わりに 1 回)
 * - 捨てるのに失敗しても要求は成功させ、記録の 1 行(console.error の JSON)を出す
 */
export async function runWithCacheTags<T>(fn: () => Promise<T> | T, deps: RunWithCacheTagsDeps = {}): Promise<T> {
  if (cacheTagStore.getStore()) return await fn();

  const store: CacheTagStore = { tags: new Set<string>() };
  try {
    return await cacheTagStore.run(store, fn);
  } finally {
    await flushCacheTags(store.tags, deps.revalidate ?? defaultRevalidate);
  }
}

async function flushCacheTags(tags: Set<string>, revalidate: RevalidateTag): Promise<void> {
  if (tags.size === 0) return;

  const failed: string[] = [];
  let firstError: unknown;
  for (const tag of tags) {
    try {
      await revalidate(tag);
    } catch (error) {
      failed.push(tag);
      firstError ??= error;
    }
  }
  if (failed.length === 0) return;

  console.error(
    JSON.stringify({
      event: "cache tags revalidate failed",
      lib: "cacheTags",
      tagCount: tags.size,
      failedCount: failed.length,
      tags: failed.slice(0, LOGGED_TAGS),
      error: firstError instanceof Error ? firstError.message : String(firstError),
    }),
  );
}
