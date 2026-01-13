// src/features/core/userProfile/generated/admin/presenters.ts
// 管理者プロフィールのプレゼンター
//
// 元情報: src/features/core/userProfile/profiles/admin.profile.json
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
 * 管理者プロフィールのプレゼンター
 */
export const adminProfilePresenters = {
  bar: ({ value }) => formatEnumLabel(value, { "apple": "apple", "orange": "orange" }),
};
