// src/features/notification/services/server/notificationService.ts

import { base } from "./drizzleBase";
import { remove } from "./wrappers/remove";
import { duplicate } from "./wrappers/duplicate";

export const notificationService = {
  ...base,
  remove,
  duplicate,
};
