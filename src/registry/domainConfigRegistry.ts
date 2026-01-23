// src/registry/domainConfigRegistry.ts

import sampleConfig from "@/features/sample/domain.json";
import sampleCategoryConfig from "@/features/sampleCategory/domain.json";
import sampleTagConfig from "@/features/sampleTag/domain.json";
import couponConfig from "@/features/core/coupon/domain.json";
import couponHistoryConfig from "@/features/core/couponHistory/domain.json";

export const domainConfigMap = {

  // --- AUTO-GENERATED-START ---
  sample: sampleConfig,
  sample_category: sampleCategoryConfig,
  sample_tag: sampleTagConfig,
  coupon: couponConfig,
  coupon_history: couponHistoryConfig,
  // --- AUTO-GENERATED-END ---

} as const;

export type DomainKey = keyof typeof domainConfigMap;
export type DomainConfig = (typeof domainConfigMap)[DomainKey];
