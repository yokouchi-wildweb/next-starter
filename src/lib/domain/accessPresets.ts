// src/lib/domain/accessPresets.ts
//
// 汎用ドメイン API (/api/[domain]/**) の権限の定型(設定の議会 D63)。上書きできる設定ではなく lib/domain の公開の定数。
// 読み手: 各ドメインの domainEntry.ts の access・定型を使う route(createApiRoute の access)・既定の解決(definition/apiAccess.ts)。
// 生成器の写し: scripts/structure/domain/render/registry/presetAccess.mjs(値の一致は registry.test.mjs が確かめる)。
// 詳細: src/lib/domain/README.md、src/lib/routeFactory/README.md

import type { DomainApiAccessConfig, DomainApiAccessRule, DomainApiRoleRule, DomainDataOperation } from "./types";

/**
 * access が当該 CRUD 操作のルールを宣言していないときの既定(fail-closed)。安全側に倒して admin カテゴリだけ許す。
 * 管理データ操作(truncateAll / export / import)はこの既定に倒れず、未指定なら "none"。
 */
export const DEFAULT_ACCESS_RULE: DomainApiAccessRule = { roleCategories: ["admin"] };

/**
 * domainEntry.ts の access で再利用するアクセスポリシーのプリセット。
 * domainEntry.ts は値だけのファイルから値を import できる（このファイルもその 1 つ。値の式と型だけで書き、関数・呼び出しを置かない）。
 * 決まりと検査: src/lib/domain/README.md・pnpm check registry。
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
