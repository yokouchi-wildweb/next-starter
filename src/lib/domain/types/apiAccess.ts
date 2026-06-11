// src/lib/domain/types/apiAccess.ts
// 汎用ドメイン API (/api/[domain]/**) のアクセス制御型定義

/**
 * 汎用ドメイン API の操作名。
 * createCrudService の操作名と 1:1 で対応する。
 */
export const DOMAIN_API_OPERATIONS = [
  "list",
  "get",
  "search",
  "count",
  "create",
  "update",
  "remove",
  "upsert",
  "duplicate",
  "restore",
  "hardDelete",
  "reorder",
  "searchForSorting",
  "bulkUpsert",
  "bulkUpdate",
  "bulkUpdateByIds",
  "bulkDeleteByIds",
  "bulkDeleteByQuery",
] as const;

export type DomainApiOperation = (typeof DOMAIN_API_OPERATIONS)[number];

/**
 * ロール指定によるアクセスルール。
 * - roles: ロール ID（roleRegistry の id）のいずれかに一致すれば許可
 * - roleCategories: ロールカテゴリ（"admin" | "user" 等）のいずれかに一致すれば許可
 * 両方指定した場合はいずれかに一致すれば許可（OR 条件）。
 */
export type DomainApiRoleRule = {
  roles?: string[];
  roleCategories?: string[];
};

/**
 * アクセスルール。
 * - "public": 未認証でもアクセス可
 * - "authenticated": ログイン済み（利用可能ステータス）なら誰でも可
 * - "none": 汎用 API を無効化（404）。専用ルートのみ公開したいドメイン用
 * - DomainApiRoleRule: 指定ロール/カテゴリのみ可
 */
export type DomainApiAccessRule =
  | "public"
  | "authenticated"
  | "none"
  | DomainApiRoleRule;

/**
 * domain.json の apiAccess 設定。
 * 未宣言の項目はグローバル既定値（fail-closed: admin カテゴリのみ）にフォールバックする。
 */
export type DomainApiAccessConfig = {
  /** 読み取り操作（list, get, search, count）の既定ルール */
  read?: DomainApiAccessRule;
  /** 書き込み操作（create, update, remove, upsert, ...）の既定ルール */
  write?: DomainApiAccessRule;
  /** 操作単位の上書き（read/write より優先） */
  operations?: Partial<Record<DomainApiOperation, DomainApiAccessRule>>;
};
