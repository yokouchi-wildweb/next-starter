// src/registry/roleRegistry.ts
// ロール設定のレジストリ（自動生成対象）
//
// このファイルは role:generate スクリプトによって更新されます。
// アンカーコメント間のコードは自動生成スクリプトによって更新されます。

import type { RoleConfig } from "@/features/core/user/types";

// === AUTO-GENERATED IMPORTS START ===
// コアロール（_ プレフィックス）
import adminRole from "@/features/core/user/roles/_admin.role.json";
import userRole from "@/features/core/user/roles/_user.role.json";
// 追加ロール
import editorRole from "@/features/core/user/roles/editor.role.json";
import contributorRole from "@/features/core/user/roles/contributor.role.json";
import debugerRole from "@/features/core/user/roles/debuger.role.json";
// === AUTO-GENERATED IMPORTS END ===

/**
 * 全ロール定義
 * コアロール（admin, user）を先頭に配置
 */
export const ALL_ROLES: readonly RoleConfig[] = [
  // === AUTO-GENERATED ENTRIES START ===
  // コアロール
  adminRole as RoleConfig,
  userRole as RoleConfig,
  // 追加ロール
  editorRole as RoleConfig,
  contributorRole as RoleConfig,
  debugerRole as RoleConfig,
  // === AUTO-GENERATED ENTRIES END ===
];
