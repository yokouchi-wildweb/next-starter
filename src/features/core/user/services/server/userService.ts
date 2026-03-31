// src/features/core/user/services/server/userService.ts

import { base } from "./drizzleBase";
import { checkAdminUserExists } from "./finders/checkAdminUserExists";
import { findByLineUserId } from "./finders/findByLineUserId";
import { findByLocalEmail } from "./finders/findByLocalEmail";
import { findByProvider } from "./finders/findByProvider";
import {
  createAdmin,
  createGeneralUser,
  createDemoUser,
  createGuestDemoUser,
} from "./creation";
import { registerFromAuth, preRegisterFromAuth } from "./registration";
import { create } from "./wrappers/create";
import { hardDelete } from "./wrappers/hardDelete";
import { remove } from "./wrappers/remove";
import { update } from "./wrappers/update";
import { updateLastAuthenticated } from "./wrappers/updateLastAuthenticated";
import { changeStatus } from "./wrappers/changeStatus";
import { changeRole } from "./wrappers/changeRole";
import { linkLineAccount } from "./wrappers/linkLineAccount";
import { unlinkLineAccount } from "./wrappers/unlinkLineAccount";
import { softDelete } from "./wrappers/softDelete";
import { searchWithProfile } from "./wrappers/searchWithProfile";

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
  findByLineUserId,
  checkAdminUserExists,
  // wrappers
  updateLastAuthenticated,
  changeStatus,
  changeRole,
  linkLineAccount,
  unlinkLineAccount,
  softDelete,
  searchWithProfile,
  // creation (console)
  createAdmin,
  createGeneralUser,
  createDemoUser,
  createGuestDemoUser,
  // registration (auth)
  registerFromAuth,
  preRegisterFromAuth,
};
