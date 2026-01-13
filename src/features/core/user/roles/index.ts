// src/features/core/user/roles/index.ts
// ロール設定の読み込みとエクスポート

import type { RoleConfig } from "../types";

// JSON ロール設定の読み込み
// コアロール（_ プレフィックス）
import adminRole from "./_admin.role.json";
import userRole from "./_user.role.json";
// 追加ロール
import editorRole from "./editor.role.json";
import contributorRole from "./contributor.role.json";

/**
 * コアロールID（システム保護）
 */
export const CORE_ROLE_IDS = ["admin", "user"] as const;
export type CoreRoleId = (typeof CORE_ROLE_IDS)[number];

/**
 * 全ロール定義
 * コアロール（admin, user）を先頭に配置
 */
export const ALL_ROLES: readonly RoleConfig[] = [
  // コアロール
  adminRole as RoleConfig,
  userRole as RoleConfig,
  // 追加ロール
  editorRole as RoleConfig,
  contributorRole as RoleConfig,
];

/**
 * ロールIDがコアロールか判定
 */
export function isCoreRole(roleId: string): roleId is CoreRoleId {
  return CORE_ROLE_IDS.includes(roleId as CoreRoleId);
}
