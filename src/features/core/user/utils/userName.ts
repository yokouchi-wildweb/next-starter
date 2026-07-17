// src/features/core/user/utils/userName.ts

import { USER_NAME_CONFIG } from "@/config/app/user-name.config";

/**
 * 表示名の重複比較用の正規化。
 * ランタイムの一意性チェック (services/server/helpers/nameAvailability.ts) と
 * 既存重複の一括解消タスク (services/server/nameDedup.ts) の両方がこの関数を使う。
 * 判定条件を変える場合はここだけを変更すること (SQL 側の対応式は nameAvailability.ts)。
 */
export function normalizeUserNameForComparison(value: string): string {
  const trimmed = value.trim();
  return USER_NAME_CONFIG.unique.caseInsensitive ? trimmed.toLowerCase() : trimmed;
}
