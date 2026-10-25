// src/config/app/domain-api-access.config.ts

import type {
  DomainApiAccessConfig,
  DomainApiAccessRule,
  DomainApiRoleRule,
  DomainDataOperation,
} from "@/lib/domain/types";

/**
 * 汎用ドメイン API (/api/[domain]/**) アクセス制御のグローバル設定
 *
 * 各ドメインのアクセスポリシーは domainEntry.ts の登録エントリ（access）で宣言する
 * （serviceRegistry は domainEntry.ts から生成される）。
 * ここでは、access に当該 CRUD 操作のルールが宣言されていない場合のフォールバック（fail-closed）を定義する。
 * 管理データ操作（truncateAll / export / import）はこの既定に倒れず、未指定なら "none"。
 * 詳細: src/lib/routeFactory/README.md、src/lib/domain/README.md
 */
export const DOMAIN_API_ACCESS_CONFIG = {
  /**
   * access が当該 CRUD 操作をカバーしない場合の既定ルール
   * 安全側に倒すため admin カテゴリのみ許可
   */
  defaultRule: { roleCategories: ["admin"] } as DomainApiAccessRule,
} as const;

/**
 * domainEntry.ts の access で再利用するアクセスポリシーのプリセット。
 * domainEntry.ts が静的 import してよいのは、このファイルと @/lib/domain/types だけ（registry:check が検査）。
 */

/** 管理者カテゴリのみを許可する単一ルール（operations の上書きに使う） */
export const ADMIN_RULE: DomainApiRoleRule = { roleCategories: ["admin"] };

/** 読み書きとも管理者カテゴリのみ */
export const ADMIN_ONLY: DomainApiAccessConfig = {
  read: ADMIN_RULE,
  write: ADMIN_RULE,
};

/** 公開読み取り + 管理者書き込み（公開マスタ等） */
export const PUBLIC_READ: DomainApiAccessConfig = {
  read: "public",
  write: ADMIN_RULE,
};

/**
 * 登録表には載せるが、汎用 API（/api/<domain>/**）にも管理データ操作（全件削除・データ移行）にも出さない。
 * サーバー内部（ドメイン名からサービス・表を引く用途）だけで使うドメイン用（監査ログ・ログインイベント等）。
 * operations を書かないので truncateAll / export / import も "none"。
 */
export const INTERNAL_ONLY: DomainApiAccessConfig = {
  read: "none",
  write: "none",
};

/**
 * 管理データ操作 3 つを管理者に開く operations の断片。
 * 使い方: `access: { ...ADMIN_ONLY, operations: ADMIN_DATA_OPERATIONS }`、
 * import だけ閉じるなら `operations: { ...ADMIN_DATA_OPERATIONS, import: "none" }`
 */
export const ADMIN_DATA_OPERATIONS: Record<DomainDataOperation, DomainApiAccessRule> = {
  truncateAll: ADMIN_RULE,
  export: ADMIN_RULE,
  import: ADMIN_RULE,
};

/**
 * 管理者カテゴリ + デバッガーロールを許可する単一ルール（OR 条件）。
 * createApiRoute の access や、operations 単位の上書きにもそのまま使える
 * （そのため DomainApiAccessRule ではなくロールルール型で宣言している）。
 */
export const ADMIN_OR_DEBUGGER_RULE: DomainApiRoleRule = {
  roles: ["debugger"],
  roleCategories: ["admin"],
};

/** 読み書きとも 管理者カテゴリ + デバッガーロールのみ（デバッグ用ドメイン等） */
export const ADMIN_OR_DEBUGGER: DomainApiAccessConfig = {
  read: ADMIN_OR_DEBUGGER_RULE,
  write: ADMIN_OR_DEBUGGER_RULE,
};
