// 生成物・編集不可: pnpm role:generate が src/features/core/user/extensionPoints.ts から生成する
// src/features/core/user/extensions/roles.ts

import type { RoleConfig } from "@/features/core/user/types";

import adminRole from "@/features/core/user/roles/_admin.role.json";
import userRole from "@/features/core/user/roles/_user.role.json";
import editorRole from "@/features/core/user/roles/editor.role.json";
import debuggerRole from "@/features/core/user/roles/debugger.role.json";
import contributorRole from "@/features/core/user/roles/contributor.role.json";

export const roles: readonly RoleConfig[] = [
  adminRole as RoleConfig,
  userRole as RoleConfig,
  editorRole as RoleConfig,
  debuggerRole as RoleConfig,
  contributorRole as RoleConfig,
];
