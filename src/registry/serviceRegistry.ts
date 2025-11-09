// src/config/serviceRegistry.ts

import { userService } from "@/features/user/services/server/userService";
import { titleService } from "@/features/title/services/server/titleService";
import { seriesService } from "@/features/series/services/server/seriesService";
import { cardTagService } from "@/features/cardTag/services/server/cardTagService";
import { cardRarityService } from "@/features/cardRarity/services/server/cardRarityService";
import { settingService } from "@/features/setting/services/server/settingService";
import { barService } from "@/features/bar/services/server/barService";
import { sampleCategoryService } from "@/features/sampleCategory/services/server/sampleCategoryService";
import { sampleService } from "@/features/sample/services/server/sampleService";

export const serviceRegistry: Record<string, any> = {

  // --- AUTO-GENERATED-START ---
  user: userService,
  title: titleService,
  series: seriesService,
  cardTag: cardTagService,
  cardRarity: cardRarityService,
  setting: settingService,
  bar: barService,
  sampleCategory: sampleCategoryService,
  sample: sampleService,
  // --- AUTO-GENERATED-END ---

};

export function registerService(domain: string, service: any) {
  serviceRegistry[domain] = service;
}
