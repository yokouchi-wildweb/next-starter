// src/lib/domain/types/apiAccess.ts
// 汎用ドメイン API (/api/[domain]/**) と管理データ操作のアクセス制御型定義

/**
 * 汎用ドメイン API の CRUD 操作名。
 * createCrudService の操作名と 1:1 で対応する（/api/[domain]/** のルートが 1 つずつ持つ）。
 */
export const DOMAIN_CRUD_OPERATIONS = [
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
  "replaceByQuery",
] as const;

/**
 * 管理データ操作の操作名。汎用 API のルートではなく、管理画面の専用ルートが評価する。
 * - truncateAll: 全件削除（POST /api/admin/domains/truncate と一覧 GET /api/admin/domains）
 * - export / import: データ移行（/api/data-migration/*）
 *
 * この 3 つは `access.operations` に明示した規則だけを見る。未指定なら "none"（閉じる）で、
 * read / write やグローバル既定（管理者）には倒れない（登録しただけで全件削除の対象になる事故を防ぐ）。
 */
export const DOMAIN_DATA_OPERATIONS = ["truncateAll", "export", "import"] as const;

/** access.operations のキーに使える操作名（CRUD + 管理データ操作） */
export const DOMAIN_API_OPERATIONS = [...DOMAIN_CRUD_OPERATIONS, ...DOMAIN_DATA_OPERATIONS] as const;

export type DomainCrudOperation = (typeof DOMAIN_CRUD_OPERATIONS)[number];
export type DomainDataOperation = (typeof DOMAIN_DATA_OPERATIONS)[number];
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
 * domain.json の apiAccess 設定（= serviceRegistry エントリの access）。
 * CRUD 操作で未宣言の項目はグローバル既定値（fail-closed: admin カテゴリのみ）にフォールバックする。
 * 管理データ操作（DOMAIN_DATA_OPERATIONS）は operations に明示したときだけ開く（未指定 = "none"）。
 */
export type DomainApiAccessConfig = {
  /** 読み取り操作（list, get, search, count）の既定ルール */
  read?: DomainApiAccessRule;
  /** 書き込み操作（create, update, remove, upsert, ...）の既定ルール */
  write?: DomainApiAccessRule;
  /** 操作単位の上書き（read/write より優先）。truncateAll / export / import はここにだけ書ける */
  operations?: Partial<Record<DomainApiOperation, DomainApiAccessRule>>;
};
