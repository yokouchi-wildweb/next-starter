// 登録の宣言 cache(登録ごとの entities/<登録名>/entity.json の "cache"、fork は entity.override.ts の cache で差し替える、D353)の語彙と正規化。
// 規則の正: src/domains/README.md「cache(共有の読みのキャッシュの宣言)」。検査は checks/cache.mjs、型は src/lib/domain/types/cache.ts。
// 生成器(包んだ関数を出す)はこの normalizeCacheDeclaration の形を読む。

import { COMMENT_KEY } from "./domainJson.mjs";

/** 廃止した置き場(ドメインのフォルダの直下の cache.json、D353)。あれば検査が止めて移し先を言う */
export const ABOLISHED_CACHE_FILE = "cache.json";

export const CACHE_KEYS = new Set(["mode", "life", "get", "list", "reads", "readsDomains", COMMENT_KEY]);
export const CACHE_LIST_KEYS = new Set(["limit", COMMENT_KEY]);
export const CACHE_READ_KEYS = new Set(["name", "where", "orderBy", "limit", "mode", "life", COMMENT_KEY]);
export const CACHE_LIFE_KEYS = new Set(["stale", "revalidate", "expire"]);

/** tagged = 書き込みでキャッシュタグを消す / ttl = 書き込みで消さず短い寿命で切れる */
export const CACHE_MODES = new Set(["tagged", "ttl"]);

/**
 * cacheLife の preset の expire(秒)。正は node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheLife.md の表。
 * "default" は expire が無い(寿命が無限)ので書けない。
 */
export const CACHE_LIFE_PRESETS = {
  seconds: 60,
  minutes: 60 * 60,
  hours: 24 * 60 * 60,
  days: 7 * 24 * 60 * 60,
  weeks: 30 * 24 * 60 * 60,
  max: 365 * 24 * 60 * 60,
};

/** 寿命の上限(秒): tagged は消し漏れ(読むドメインの書き忘れ)を受ける上限、ttl は書き込みで消さない分の短さ */
export const CACHE_LIFE_LIMITS = {
  tagged: 30 * 24 * 60 * 60,
  ttl: 60 * 60,
};

/** readsDomains の数の上限(Vercel Runtime Cache の 1 項目のキャッシュタグは 128 まで。get は自分のキャッシュタグ 2 つ + 読むドメインのキャッシュタグ) */
export const CACHE_MAX_READS_DOMAINS = 100;

/** 包む list・名前付きの読みの limit の上限(覚える値の大きさを抑える) */
export const CACHE_MAX_LIMIT = 1000;

/** where の op(正は src/lib/crud/types/query.ts の QueryOp) */
export const CACHE_WHERE_OPS = new Set([
  "eq", "ne", "lt", "lte", "gt", "gte", "like", "startsWith", "endsWith", "in", "notIn", "isNull", "isNotNull",
  "contains", "containedBy", "hasKey", "arrayContains", "arrayOverlaps",
]);
export const CACHE_WHERE_NO_VALUE_OPS = new Set(["isNull", "isNotNull"]);

/** 寿命の宣言 → expire(秒)。読めない形は null */
export function cacheLifeExpire(life) {
  if (typeof life === "string") return Object.hasOwn(CACHE_LIFE_PRESETS, life) ? CACHE_LIFE_PRESETS[life] : null;
  if (life && typeof life === "object" && !Array.isArray(life) && Number.isInteger(life.expire)) return life.expire;
  return null;
}

/**
 * 既定を埋めた形(検査を通った宣言を渡す)。
 * get の既定 true、list・reads・readsDomains の既定は無し / 空、reads の mode・life は宣言の頭の値を継ぐ。
 * @returns {import("../../../../src/lib/domain/types/cache").NormalizedDomainCache}
 */
export function normalizeCacheDeclaration(cache) {
  const { mode, life } = cache;
  return {
    mode,
    life,
    get: cache.get !== false,
    list: cache.list ? { limit: cache.list.limit } : null,
    reads: (cache.reads ?? []).map((read) => ({
      name: read.name,
      where: read.where ?? null,
      orderBy: read.orderBy ?? null,
      limit: read.limit,
      mode: read.mode ?? mode,
      life: read.life ?? life,
    })),
    readsDomains: [...(cache.readsDomains ?? [])],
  };
}
