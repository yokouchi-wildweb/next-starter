// src/domains/couponHistory/services/server/couponHistoryService.ts

import { couponHistoryBase } from "./couponHistoryBase";
import { recordUsage } from "./recordUsage";

export const couponHistoryService = {
  ...couponHistoryBase,
  recordUsage,
};
