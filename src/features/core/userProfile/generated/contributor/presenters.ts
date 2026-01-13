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
} from "@/lib/presenters/formatters";
import { formatDateJa } from "@/utils/date";

/**
 * 投稿者プロフィールのプレゼンター
 */
export const contributorProfilePresenters = {
  organizationName: ({ value }) => formatString(value),
  contactPhone: ({ value }) => formatString(value),
  bio: ({ value }) => formatString(value),
  isApproved: ({ value }) => formatBoolean(value, "はい", "いいえ"),
  approvedAt: ({ value }) => formatString(value),
  approvalNote: ({ value }) => formatString(value),
};
