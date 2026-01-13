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
} from "@/lib/crud/presenters";
import { formatDateJa } from "@/utils/date";

/**
 * 投稿者プロフィールのプレゼンター
 */
export const contributorProfilePresenters = {
  organizationName: ({ value }: { value: unknown }) => formatString(value),
  contactPhone: ({ value }: { value: unknown }) => formatString(value),
  bio: ({ value }: { value: unknown }) => formatString(value),
  isApproved: ({ value }: { value: unknown }) => formatBoolean(value, "はい", "いいえ"),
  approvedAt: ({ value }: { value: unknown }) => formatString(value),
  approvalNote: ({ value }: { value: unknown }) => formatString(value),
};
