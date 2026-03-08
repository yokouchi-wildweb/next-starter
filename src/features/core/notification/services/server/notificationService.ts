// src/features/notification/services/server/notificationService.ts

import { base } from "./drizzleBase";
import { create } from "./wrappers/create";
import { update } from "./wrappers/update";

export const notificationService = {
  ...base,
  create,
  update,
};
