// src/config/serviceRegistry.ts

import { userService } from "@/features/core/user/services/server/userService";
import { settingService } from "@/features/core/setting/services/server/settingService";
import { sampleCategoryService } from "@/features/sampleCategory/services/server/sampleCategoryService";
import { sampleTagService } from "@/features/sampleTag/services/server/sampleTagService";
import { walletService } from "@/features/core/wallet/services/server/walletService";
import { walletHistoryService } from "@/features/core/walletHistory/services/server/walletHistoryService";
import { purchaseRequestService } from "@/features/core/purchaseRequest/services/server/purchaseRequestService";
import { sampleService } from "@/features/sample/services/server/sampleService";

export const serviceRegistry: Record<string, any> = {

  // --- AUTO-GENERATED-START ---
  user: userService,
  setting: settingService,
  sampleCategory: sampleCategoryService,
  sampleTag: sampleTagService,
  wallet: walletService,
  walletHistory: walletHistoryService,
  purchaseRequest: purchaseRequestService,
  sample: sampleService,
  // --- AUTO-GENERATED-END ---

};

export function registerService(domain: string, service: any) {
  serviceRegistry[domain] = service;
}
