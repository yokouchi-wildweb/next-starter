// src/lib/domain/types/cache.ts
// ドメインの宣言 cache(登録の entity.json の "cache"、domain.json の無いドメインは <domain>/cache.json)の型。
// 語彙・上限・正規化の正: scripts/structure/domain/spec/cache.mjs、検査: scripts/structure/domain/checks/cache.mjs。
// 規則: src/domains/README.md「cache(共有の読みのキャッシュの宣言)」

/**
 * 名前付きの読みの条件と並び。形は lib/crud の DomainCacheWhere・DomainCacheOrderBy(src/lib/crud/types/query.ts)と同じ
 * (lib/domain は crud を読まないので形だけを持つ。生成器の出力を crud の型が受けるので食い違えば typecheck が止める)。
 * op の一覧の正は crud の QueryOp(検査は scripts/structure/domain/spec/cache.mjs の CACHE_WHERE_OPS)
 */
export type DomainCacheWhere =
  | { field: string; op: string; value?: unknown }
  | { and: DomainCacheWhere[] }
  | { or: DomainCacheWhere[] };
export type DomainCacheOrderBy = Array<[string, "ASC" | "DESC", ("FIRST" | "LAST")?]>;

/** tagged = 書き込みでキャッシュタグを消す / ttl = 書き込みで消さず短い寿命で切れる */
export type DomainCacheMode = "tagged" | "ttl";

/** cacheLife の preset("default" は寿命が無限、"seconds" は覚えないので書けない)か、秒の寿命(expire 必須) */
export type DomainCacheLife =
  | "minutes"
  | "hours"
  | "days"
  | "weeks"
  | "max"
  | { stale?: number; revalidate?: number; expire: number };

/** 条件を宣言で固めた名前付きの読み(base.search の固定の引数。引数を取らない) */
export type DomainCacheRead = {
  name: string;
  where?: DomainCacheWhere;
  orderBy?: DomainCacheOrderBy;
  limit: number;
  mode?: DomainCacheMode;
  life?: DomainCacheLife;
};

/** 宣言のまま(登録の entity.json の cache / cache.json) */
export type DomainCacheDeclaration = {
  mode: DomainCacheMode;
  life: DomainCacheLife;
  /** base.get(id) を包む(既定 true) */
  get?: boolean;
  /** 上限つきの list を包む */
  list?: { limit: number };
  reads?: DomainCacheRead[];
  /** この読みが読む他のドメイン(地区の地図の名前)。そのキャッシュタグの書き込みでも消える */
  readsDomains?: string[];
};

/** 既定を埋めた形(生成器が読む) */
export type NormalizedDomainCache = {
  mode: DomainCacheMode;
  life: DomainCacheLife;
  get: boolean;
  list: { limit: number } | null;
  reads: Array<Required<Pick<DomainCacheRead, "name" | "limit" | "mode" | "life">> & { where: DomainCacheWhere | null; orderBy: DomainCacheOrderBy | null }>;
  readsDomains: string[];
};
