// 生成物・編集不可: pnpm generate role が src/domains/core/user/extensionPoints.ts から生成する
// src/domains/core/user/extensions/roles.ts

import type { RoleConfig } from "@/domains/core/user/types";

import adminRole from "@/domains/core/user/coreRoles/admin.role.json";
import userRole from "@/domains/core/user/coreRoles/user.role.json";
import editorRole from "@/domains/core/user/roles/editor.role.json";
import debuggerRole from "@/domains/core/user/coreRoles/debugger.role.json";
import contributorRole from "@/domains/core/user/roles/contributor.role.json";

export const roles: readonly RoleConfig[] = [
  adminRole as RoleConfig,
  userRole as RoleConfig,
  editorRole as RoleConfig,
  debuggerRole as RoleConfig,
  contributorRole as RoleConfig,
];
