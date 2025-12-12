// src/registry/domainConfigRegistry.ts

import sampleConfig from "@/features/sample/domain.json";
import sampleCategoryConfig from "@/features/sampleCategory/domain.json";
import sampleTagConfig from "@/features/sampleTag/domain.json";
import walletConfig from "@/features/core/wallet/domain.json";
import walletHistoryConfig from "@/features/core/walletHistory/domain.json";
import purchaseRequestConfig from "@/features/core/purchaseRequest/domain.json";

export const domainConfigMap = {

  // --- AUTO-GENERATED-START ---
  sample: sampleConfig,
  sample_category: sampleCategoryConfig,
  sample_tag: sampleTagConfig,
  wallet: walletConfig,
  wallet_history: walletHistoryConfig,
  purchase_request: purchaseRequestConfig,
  // --- AUTO-GENERATED-END ---

} as const;

export type DomainKey = keyof typeof domainConfigMap;
export type DomainConfig = (typeof domainConfigMap)[DomainKey];
