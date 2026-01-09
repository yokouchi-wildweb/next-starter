// src/features/core/user/constants/status.ts

import type { Options } from "@/types/form";

export const USER_STATUSES = [
  "pending",
  "active",
  "inactive",
  "suspended",
  "banned",
  "security_locked",
  "withdrawn",
] as const;

type UserStatus = (typeof USER_STATUSES)[number];

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  pending: "仮登録",
  active: "有効",
  inactive: "休止中",
  suspended: "一時停止",
  banned: "永久追放",
  security_locked: "セキュリティロック",
  withdrawn: "退会済み",
};

export const USER_STATUS_OPTIONS: Options[] = USER_STATUSES.map((status) => ({
  value: status,
  label: USER_STATUS_LABELS[status] ?? status,
}));

export const formatUserStatusLabel = (
  status: string | null | undefined,
  fallback = "",
): string => {
  if (!status) {
    return fallback;
  }
  return USER_STATUS_LABELS[status as UserStatus] ?? status;
};

// 利用可能なステータス（ログイン可能）
export const USER_AVAILABLE_STATUSES: readonly UserStatus[] = ["active"];

// 本登録済みステータス（再登録不可）
export const USER_REGISTERED_STATUSES: readonly UserStatus[] = [
  "active",
  "inactive",
  "suspended",
  "banned",
  "security_locked",
];
