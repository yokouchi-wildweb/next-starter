// src/lib/crud/drizzle/cacheTags.ts

import { cacheRowsTagOf, cacheTagOf, markCacheTags } from "@/lib/cacheTags/server";

import { WRITE_METHOD_NAMES } from "./requestMemo";

/** createCrudService の option cacheTags: このサービスの書き込みが積むキャッシュタグのドメイン(地区の地図の名前) */
export type CrudCacheTagsOption = { domain: string };

export type CacheTagsAugmented = {
  /**
   * このドメインのキャッシュタグを手で積む。createCrudService を経由しない生 SQL でこのテーブルを書いた直後に呼ぶ。
   * ids を渡せばその行のキャッシュタグ、渡さなければ行の全部のキャッシュタグ(どの行か分からない書き込み)。
   * option cacheTags の無いサービスでは何もしない。
   */
  markCacheTags: (ids?: readonly (string | number)[]) => void;
};

type AnyAsyncFn = (...args: unknown[]) => Promise<unknown>;
/** 書き込みの id の取り方: args = 引数から(throw でも取れる)/ result = 戻り値から(throw では取れない) */
type IdSource = { from: "args" | "result"; ids: (args: unknown[], result: unknown) => unknown[] };

const idOf = (value: unknown): unknown => (value && typeof value === "object" ? (value as { id?: unknown }).id : undefined);
const listArg = (args: unknown[]) => (Array.isArray(args[0]) ? args[0] : []);
const firstArg: IdSource = { from: "args", ids: (args) => [args[0]] };
const resultId: IdSource = { from: "result", ids: (_args, result) => [idOf(result)] };

/**
 * id の分かる書き込みと、その id の取り方。ここに無い書き込みのメソッド(WRITE_METHOD_NAMES の残り:
 * 条件の一括・並べ替え・置き換え・関係の一括・全削除)は行の全部のキャッシュタグを消す。
 * 戻り値から取る物が throw した時は id が無いので、行の全部のキャッシュタグに落とす(安全側)。
 */
const ID_SOURCES: Record<string, IdSource> = {
  create: resultId,
  upsert: resultId,
  duplicate: resultId,
  duplicateWithIdMap: { from: "result", ids: (_args, result) => [idOf((result as { record?: unknown } | undefined)?.record)] },
  update: firstArg,
  systemUpdate: firstArg,
  delete: firstArg,
  restore: firstArg,
  hardDelete: firstArg,
  bulkDeleteByIds: { from: "args", ids: listArg },
  bulkHardDeleteByIds: { from: "args", ids: listArg },
  bulkUpdateByIds: { from: "args", ids: listArg },
  bulkUpdate: { from: "args", ids: (args) => listArg(args).map(idOf) },
  bulkUpsert: { from: "result", ids: (_args, result) => ((result as { results?: unknown[] } | undefined)?.results ?? []).map(idOf) },
};

const isId = (id: unknown): id is string | number => (typeof id === "string" && id.length > 0) || typeof id === "number";

/** ids = null は「どの行か分からない」、空の配列は「行を書いていない」(ドメインのキャッシュタグだけ) */
function markWrite(domain: string, ids: unknown[] | null): void {
  const known = ids?.filter(isId) ?? [];
  if (ids && known.length === ids.length) {
    markCacheTags(cacheTagOf(domain), ...known.map((id) => cacheTagOf(domain, id)));
  } else {
    markCacheTags(cacheTagOf(domain), cacheRowsTagOf(domain));
  }
}

/**
 * サービスの書き込みのメソッドを包み、終わり(成功でも throw でも)にこのドメインのキャッシュタグを積む。
 * 積んだキャッシュタグは入口(routeFactory・cron)の runWithCacheTags が要求の終わりにまとめて消す(src/lib/cacheTags)。
 * - id の分かる書き込み = ドメインのキャッシュタグ + 行のキャッシュタグ / 分からない書き込み = ドメインのキャッシュタグ + 行の全部のキャッシュタグ
 * - 積むのはメソッドの return の時点(外側のトランザクションのコミットを待たない)。消すのは要求の終わりなので、
 *   ロールバックした分を余分に消すだけ(無害)
 */
export function applyCacheTags<S extends object>(service: S, option: CrudCacheTagsOption | undefined): S & CacheTagsAugmented {
  if (!option) return { ...service, markCacheTags: () => {} };
  const { domain } = option;
  cacheTagOf(domain);

  const decorated = { ...service } as S & CacheTagsAugmented;
  const mutable = decorated as unknown as Record<string, unknown>;
  for (const name of WRITE_METHOD_NAMES) {
    const original = (service as Record<string, unknown>)[name];
    if (typeof original !== "function") continue;
    const source = ID_SOURCES[name];
    mutable[name] = async (...args: unknown[]) => {
      let result: unknown;
      let ok = false;
      try {
        result = await (original as AnyAsyncFn).apply(decorated, args);
        ok = true;
        return result;
      } finally {
        markWrite(domain, source && (ok || source.from === "args") ? source.ids(args, result) : null);
      }
    };
  }
  decorated.markCacheTags = (ids) => markWrite(domain, ids && ids.length > 0 ? [...ids] : null);
  return decorated;
}
