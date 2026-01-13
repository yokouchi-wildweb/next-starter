// src/features/core/user/constants/role.ts

import {
  ADDITIONAL_ROLES,
  CORE_ROLE_EXTENSIONS,
  type ProfileFieldTag,
} from "@/config/app/roles.config";
import type {
  RoleCategory,
  RoleConfig,
  AdditionalRoleConfig,
  ProfileFieldConfig,
  CoreProfileFieldTag,
} from "@/features/core/user/types";

// 型の re-export（後方互換性のため）
export type {
  RoleCategory,
  RoleConfig,
  AdditionalRoleConfig,
  ProfileFieldConfig,
  CoreProfileFieldTag,
} from "@/features/core/user/types";

export type { ProfileFieldTag } from "@/config/app/roles.config";

// domain.json 共通型の re-export
export type {
  DomainFormInput,
  DomainFieldType,
  DomainJsonField,
} from "@/components/Form/DomainFieldRenderer/types";

/**
 * コアロールの基本定義（システム必須、削除不可）
 */
const CORE_ROLE_BASE = {
  admin: {
    id: "admin",
    label: "管理者",
    category: "admin" as const,
    description: "システム全体を管理できる",
  },
  user: {
    id: "user",
    label: "一般",
    category: "user" as const,
    description: "一般ユーザー",
  },
} as const;

/**
 * コアロール定義（基本 + 拡張をマージ）
 */
const CORE_ROLES: readonly RoleConfig<ProfileFieldTag>[] = [
  {
    ...CORE_ROLE_BASE.admin,
    hasProfile: CORE_ROLE_EXTENSIONS.admin?.hasProfile ?? false,
    profileFields: CORE_ROLE_EXTENSIONS.admin?.profileFields,
  },
  {
    ...CORE_ROLE_BASE.user,
    hasProfile: CORE_ROLE_EXTENSIONS.user?.hasProfile ?? false,
    profileFields: CORE_ROLE_EXTENSIONS.user?.profileFields,
  },
];

/**
 * 全ロール定義（コア + 追加）
 */
export const ALL_ROLES: readonly RoleConfig<ProfileFieldTag>[] = [
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
 * 指定タグを持つフィールドを取得（汎用フィルタ）
 * @param role ロール
 * @param includeTags 含めるタグ（いずれかにマッチ）
 * @param excludeHidden hidden フィールドを除外するか（デフォルト: true）
 */
export const getFieldsByTags = (
  role: UserRoleType,
  includeTags: ProfileFieldTag[],
  excludeHidden = true,
): ProfileFieldConfig[] => {
  if (!hasRoleProfile(role)) {
    return [];
  }
  const fields = getProfileFields(role);
  return fields.filter((field) => {
    if (excludeHidden && field.formInput === "hidden") {
      return false;
    }
    return field.tags.some((tag) => includeTags.includes(tag as ProfileFieldTag));
  }) as ProfileFieldConfig[];
};

/**
 * 本登録画面で表示するフィールドを取得
 */
export const getRegistrationFields = (
  role: UserRoleType,
): ProfileFieldConfig[] => {
  return getFieldsByTags(role, ["registration"]);
};

/**
 * マイページで表示するフィールドを取得
 */
export const getMyPageFields = (
  role: UserRoleType,
): ProfileFieldConfig[] => {
  return getFieldsByTags(role, ["mypage"]);
};

/**
 * 管理画面で表示するフィールドを取得（hidden 除く全て）
 */
export const getAdminFields = (
  role: UserRoleType,
): ProfileFieldConfig[] => {
  if (!hasRoleProfile(role)) {
    return [];
  }
  const fields = getProfileFields(role);
  return fields.filter((field) => field.formInput !== "hidden") as ProfileFieldConfig[];
};
