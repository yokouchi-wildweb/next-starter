// src/features/core/user/constants/role.ts

export const USER_ROLES = ["admin", "user"] as const;

export const USER_ROLE_OPTIONS = [
  { id: "admin", name: "管理者" },
  { id: "user", name: "一般" },
] as const;

type UserRoleType = (typeof USER_ROLES)[number];

export const USER_ROLE_LABELS: Record<UserRoleType, string> = {
  admin: "管理者",
  user: "一般",
};

export const formatUserRoleLabel = (
  role: string | null | undefined,
  fallback = "",
): string => {
  if (!role) {
    return fallback;
  }
  return USER_ROLE_LABELS[role as UserRoleType] ?? role;
};
