// src/lib/cacheTags/server.ts — キャッシュタグを集める範囲と捨てる処理(node の AsyncLocalStorage・next/cache)。server だけが読む
// 入口(route factory など)が runWithCacheTags で包み、書き込みの側が markCacheTags で積む。

export { cacheRowsTagOf, cacheTagOf } from "./tag";
export { readThrough } from "./readThrough";
export { defineSharedRead, type SharedReadLife, type SharedReadOptions } from "./sharedRead";
export {
  markCacheTags,
  runWithCacheTags,
  type RevalidateTag,
  type RunWithCacheTagsDeps,
} from "./context";
