// src/features/core/user/constants/role.ts
// ロール派生定数

import { ALL_ROLES } from "@/registry/roleRegistry";

/**
 * ロールID配列（DBスキーマ、バリデーション用）
 */
export const USER_ROLES = ALL_ROLES.map((r) => r.id) as unknown as readonly [
  "admin",
  "user",
  ...string[],
];

/**
 * ロールの型
 */
export type UserRoleType = (typeof USER_ROLES)[number];
