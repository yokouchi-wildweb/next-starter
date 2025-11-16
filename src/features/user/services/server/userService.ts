// src/features/user/services/server/userService.ts

import { base } from "./drizzleBase";
import { create } from "./wrappers/create";
import { remove } from "./wrappers/remove";
import { update } from "./wrappers/update";
export { userRegistrationService } from "./userRegistrationService";

export const userService = {
  ...base,
  create,
  remove,
  update,
};
