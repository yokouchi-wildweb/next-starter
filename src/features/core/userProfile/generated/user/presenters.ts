// src/features/core/userProfile/generated/user/presenters.ts
// 一般プロフィールのプレゼンター
//
// 元情報: src/features/core/userProfile/profiles/user.profile.json
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
 * 一般プロフィールのプレゼンター
 */
export const userProfilePresenters = {
  foo: ({ value }) => formatString(value),
};
