// src/features/core/analytics/services/server/coinIssuance/issuanceCategories.ts
// 発行 wallet_bonus_grant に数える reason_category(analytics の設定 issuanceReasonCategories、D74)

import { analyticsConfig } from "@/features/analytics/config";
import type { ReasonCategory } from "@/features/walletHistory/config";

/** 発行に数える区分(設定の並び順) */
export function issuanceReasonCategories(
  categories: readonly ReasonCategory[] = analyticsConfig.issuanceReasonCategories,
): ReasonCategory[] {
  return [...categories];
}
