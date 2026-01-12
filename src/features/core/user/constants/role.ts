// src/features/core/user/constants/role.ts

import {
  ADDITIONAL_ROLES,
  type AdditionalRoleConfig,
  type ProfileFieldConfig,
  type RoleCategory,
} from "@/config/app/roles.config";

// 型の re-export
export type {
  RoleCategory,
  AdditionalRoleConfig,
  ProfileFieldConfig,
  ProfileFieldInputType,
} from "@/config/app/roles.config";

/**
 * ロール定義の型（コア + 追加で共通）
 */
export type RoleConfig = {
  readonly id: string;
  readonly label: string;
  readonly category: RoleCategory;
  readonly hasProfile: boolean;
  readonly description?: string;
  readonly profileFields?: readonly ProfileFieldConfig[];
};

/**
 * コアロール定義（システム必須、削除不可）
 */
const CORE_ROLES: readonly RoleConfig[] = [
  {
    id: "admin",
    label: "管理者",
    category: "admin",
    hasProfile: false,
    description: "システム全体を管理できる",
  },
  {
    id: "user",
    label: "一般",
    category: "user",
    hasProfile: false,
    description: "一般ユーザー",
  },
];

/**
 * 全ロール定義（コア + 追加）
 */
export const ALL_ROLES: readonly RoleConfig[] = [
  ...CORE_ROLES,
  ...ADDITIONAL_ROLES,
];

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
 * ロールのカテゴリマッピング
 */
export const USER_ROLE_CATEGORIES: Record<UserRoleType, RoleCategory> =
  Object.fromEntries(ALL_ROLES.map((r) => [r.id, r.category])) as Record<
    UserRoleType,
    RoleCategory
  >;

/**
 * ロールがプロフィールを持つかのマッピング
 */
export const USER_ROLE_HAS_PROFILE: Record<UserRoleType, boolean> =
  Object.fromEntries(ALL_ROLES.map((r) => [r.id, r.hasProfile])) as Record<
    UserRoleType,
    boolean
  >;

/**
 * カテゴリ別のロールID配列を取得
 */
export const getRolesByCategory = (category: RoleCategory): UserRoleType[] => {
  return ALL_ROLES.filter((r) => r.category === category).map(
    (r) => r.id,
  ) as UserRoleType[];
};

/**
 * カテゴリ別のロールオプションを取得（セレクトボックス用）
 */
export const getRoleOptionsByCategory = (
  category: RoleCategory,
): readonly { id: UserRoleType; name: string }[] => {
  return ALL_ROLES.filter((r) => r.category === category).map((r) => ({
    id: r.id as UserRoleType,
    name: r.label,
  }));
};

/**
 * プロフィールを持つロールのID配列を取得
 */
export const getRolesWithProfile = (): UserRoleType[] => {
  return ALL_ROLES.filter((r) => r.hasProfile).map(
    (r) => r.id,
  ) as UserRoleType[];
};

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

/**
 * ロールのカテゴリを取得
 */
export const getRoleCategory = (role: UserRoleType): RoleCategory => {
  return USER_ROLE_CATEGORIES[role];
};

/**
 * ロールがプロフィールを持つか判定
 */
export const hasRoleProfile = (role: UserRoleType): boolean => {
  return USER_ROLE_HAS_PROFILE[role];
};

/**
 * ロールのプロフィールフィールド設定を取得
 */
export const getProfileFields = (
  role: UserRoleType,
): readonly ProfileFieldConfig[] => {
  const roleConfig = ALL_ROLES.find((r) => r.id === role);
  return roleConfig?.profileFields ?? [];
};

/**
 * 本登録画面で表示するフィールドを取得
 */
export const getRegistrationFields = (
  role: UserRoleType,
): ProfileFieldConfig[] => {
  if (!hasRoleProfile(role)) {
    return [];
  }
  const fields = getProfileFields(role);
  return fields.filter((field) => field.showOnRegistration);
};
