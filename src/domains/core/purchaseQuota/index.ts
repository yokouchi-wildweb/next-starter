// src/domains/core/purchaseQuota/index.ts
//
// 購入クォータドメインのバレル。
//
// サーバー専用 API (db アクセスを含む) はここから直接 export せず、
// 利用側で `@/domains/core/purchaseQuota/services/server/wrappers/purchaseQuotaHelper`
// から import する。クライアントから誤って参照されないようにするため。

export * from "./constants";
export type { PurchaseQuotaLedger } from "./entities/model";
export type { QuotaRule, QuotaScope } from "./config";
