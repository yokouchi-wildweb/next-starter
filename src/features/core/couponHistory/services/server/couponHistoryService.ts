// src/features/couponHistory/services/server/couponHistoryService.ts

import { base } from "./drizzleBase";
import { recordUsage } from "./recordUsage";

export const couponHistoryService = {
  ...base,
  recordUsage,
};
