// src/config/serviceRegistry.ts

import { userService } from "@/features/user/services/server/userService";
import { settingService } from "@/features/setting/services/server/settingService";
import { sampleCategoryService } from "@/features/sampleCategory/services/server/sampleCategoryService";
import { sampleService } from "@/features/sample/services/server/sampleService";

export const serviceRegistry: Record<string, any> = {

  // --- AUTO-GENERATED-START ---
  user: userService,
  setting: settingService,
  sampleCategory: sampleCategoryService,
  sample: sampleService,
  // --- AUTO-GENERATED-END ---

};

export function registerService(domain: string, service: any) {
  serviceRegistry[domain] = service;
}
