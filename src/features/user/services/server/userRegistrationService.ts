// src/features/user/services/server/userRegistrationService.ts

import {
  registerAdminFromConsole,
  registerGeneralUserFromConsole,
} from "./registrations";

export const userRegistrationService = {
  registerAdminFromConsole,
  registerGeneralUserFromConsole,
} as const;
