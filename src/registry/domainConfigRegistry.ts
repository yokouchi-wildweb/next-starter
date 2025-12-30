// src/registry/domainConfigRegistry.ts

import walletConfig from "@/features/core/wallet/domain.json";
import walletHistoryConfig from "@/features/core/walletHistory/domain.json";
import purchaseRequestConfig from "@/features/core/purchaseRequest/domain.json";
import sampleConfig from "@/features/sample/domain.json";
import sampleCategoryConfig from "@/features/sampleCategory/domain.json";
import sampleTagConfig from "@/features/sampleTag/domain.json";
import fooConfig from "@/features/foo/domain.json";

export const domainConfigMap = {

  // --- AUTO-GENERATED-START ---
  wallet: walletConfig,
  wallet_history: walletHistoryConfig,
  purchase_request: purchaseRequestConfig,
  sample: sampleConfig,
  sample_category: sampleCategoryConfig,
  sample_tag: sampleTagConfig,
  foo: fooConfig,
  // --- AUTO-GENERATED-END ---

} as const;

export type DomainKey = keyof typeof domainConfigMap;
export type DomainConfig = (typeof domainConfigMap)[DomainKey];
