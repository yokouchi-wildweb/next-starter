// src/features/core/analytics/services/server/coinIssuance/issuanceCategories.ts
// 発行 wallet_bonus_grant に数える reason_category(wallet-reason-category.config の countsAsIssuance の区分)

import {
  REASON_CATEGORY_CONFIG,
  type ReasonCategory,
  type ReasonCategoryConfig,
} from "@/config/app/wallet-reason-category.config";

/** countsAsIssuance が true の区分(config の並び順) */
export function issuanceReasonCategories(
  config: Readonly<Record<string, ReasonCategoryConfig>> = REASON_CATEGORY_CONFIG,
): ReasonCategory[] {
  return Object.entries(config)
    .filter(([, category]) => category.countsAsIssuance === true)
    .map(([key]) => key as ReasonCategory);
}
