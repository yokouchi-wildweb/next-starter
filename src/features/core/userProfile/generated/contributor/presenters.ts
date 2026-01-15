// src/features/core/userProfile/generated/contributor/presenters.ts
// 投稿者プロフィールのプレゼンター
//
// 元情報: src/features/core/userProfile/profiles/contributor.profile.json
// このファイルは role:generate スクリプトによって自動生成されました

import {
  formatBoolean,
  formatDateValue,
  formatEnumLabel,
  formatNumber,
  formatString,
  formatStringArray,
} from "@/lib/crud";
import { formatDateJa } from "@/utils/date";

/**
 * 投稿者プロフィールのプレゼンター
 */
export const contributorProfilePresenters = {
  isApproved: ({ value }: { value: unknown }) => formatBoolean(value, "はい", "いいえ"),
  approvedAt: ({ value }: { value: unknown }) => formatDateValue(value, "YYYY/MM/DD HH:mm", (val, fmt) => formatDateJa(val, { format: fmt, fallback: null })),
  approvalNote: ({ value }: { value: unknown }) => formatString(value),
};
