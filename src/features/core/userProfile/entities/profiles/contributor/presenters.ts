// 生成物・編集不可: pnpm generate role が src/features/core/userProfile/profiles/contributor.profile.json から生成する
// src/features/core/userProfile/entities/profiles/contributor/presenters.ts
// 投稿者プロフィールのプレゼンター
//
// 元情報: src/features/core/userProfile/profiles/contributor.profile.json
// このファイルは pnpm generate role によって自動生成されました

import {
  formatBoolean,
  formatDateValue,
  formatEnumLabel,
  formatNumber,
  formatString,
  formatStringArray,
} from "@/lib/crud/presenters";
import { formatDateJa } from "@/utils/date";

/**
 * 投稿者プロフィールのプレゼンター
 */
export const contributorProfilePresenters = {
  isApproved: ({ value }: { value: unknown }) => formatBoolean(value, "はい", "いいえ"),
  approvedAt: ({ value }: { value: unknown }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
  approvalNote: ({ value }: { value: unknown }) => formatString(value),
};
