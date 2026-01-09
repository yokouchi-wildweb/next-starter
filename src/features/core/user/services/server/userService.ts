// src/features/core/user/services/server/userService.ts

import { base } from "./drizzleBase";
import { checkAdminUserExists } from "./finders/checkAdminUserExists";
import { findByLocalEmail } from "./finders/findByLocalEmail";
import { findByProvider } from "./finders/findByProvider";
import {
  createAdmin,
  createGeneralUser,
  createDemoUser,
  createFromRegistration,
  createGuestDemoUser,
} from "./creation";
import { create } from "./wrappers/create";
import { hardDelete } from "./wrappers/hardDelete";
import { remove } from "./wrappers/remove";
import { update } from "./wrappers/update";
import { updateLastAuthenticated } from "./wrappers/updateLastAuthenticated";
import { changeStatus } from "./wrappers/changeStatus";

export { requireCurrentUser } from "./resolvers/requireCurrentUser";
export type { RequireCurrentUserOptions } from "./resolvers/requireCurrentUser";

export const userService = {
  ...base,
  create,
  remove,
  hardDelete,
  update,
  // finders
  findByProvider,
  findByLocalEmail,
  checkAdminUserExists,
  // wrappers
  updateLastAuthenticated,
  changeStatus,
  // creation (console)
  createAdmin,
  createGeneralUser,
  createDemoUser,
  // creation (auth)
  createFromRegistration,
  createGuestDemoUser,
};
