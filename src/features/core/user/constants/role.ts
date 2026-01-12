// src/features/core/user/constants/role.ts

import { ADDITIONAL_ROLES } from "@/config/app/roles.config";

/**
 * コアロール定義（システム必須、削除不可）
 */
const CORE_ROLES = [
  { id: "admin", label: "管理者", description: "システム全体を管理できる" },
  { id: "user", label: "一般", description: "一般ユーザー" },
] as const;

/**
 * 全ロール定義（コア + 追加）
 */
const ALL_ROLES = [...CORE_ROLES, ...ADDITIONAL_ROLES];

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

/**
 * UI表示用のロールオプション（セレクトボックス等）
 */
export const USER_ROLE_OPTIONS: readonly { id: UserRoleType; name: string }[] =
  ALL_ROLES.map((r) => ({ id: r.id, name: r.label })) as readonly {
    id: UserRoleType;
    name: string;
  }[];

/**
 * ロールのラベルマッピング
 */
export const USER_ROLE_LABELS: Record<UserRoleType, string> = Object.fromEntries(
  ALL_ROLES.map((r) => [r.id, r.label]),
) as Record<UserRoleType, string>;

/**
 * ロールの説明マッピング
 */
export const USER_ROLE_DESCRIPTIONS: Record<UserRoleType, string | undefined> =
  Object.fromEntries(ALL_ROLES.map((r) => [r.id, r.description])) as Record<
    UserRoleType,
    string | undefined
  >;

/**
 * ロールラベルのフォーマッタ
 */
export const formatUserRoleLabel = (
  role: string | null | undefined,
  fallback = "",
): string => {
  if (!role) {
    return fallback;
  }
  return USER_ROLE_LABELS[role as UserRoleType] ?? role;
};
