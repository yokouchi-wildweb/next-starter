// src/config/serviceRegistry.ts

import { userService } from "@/features/core/user/services/server/userService";
import { userActionLogService } from "@/features/core/userActionLog/services/server/userActionLogService";
import { settingService } from "@/features/core/setting/services/server/settingService";
import { walletService } from "@/features/core/wallet/services/server/walletService";
import { walletHistoryService } from "@/features/core/walletHistory/services/server/walletHistoryService";
import { purchaseRequestService } from "@/features/core/purchaseRequest/services/server/purchaseRequestService";
import { sampleService } from "@/features/sample/services/server/sampleService";
import { sampleCategoryService } from "@/features/sampleCategory/services/server/sampleCategoryService";
import { sampleTagService } from "@/features/sampleTag/services/server/sampleTagService";

export const serviceRegistry: Record<string, any> = {
  userActionLog: userActionLogService,

  // --- AUTO-GENERATED-START ---
  user: userService,
  setting: settingService,
  wallet: walletService,
  walletHistory: walletHistoryService,
  purchaseRequest: purchaseRequestService,
  sample: sampleService,
  sampleCategory: sampleCategoryService,
  sampleTag: sampleTagService,
  // --- AUTO-GENERATED-END ---

};

export function registerService(domain: string, service: any) {
  serviceRegistry[domain] = service;
}
