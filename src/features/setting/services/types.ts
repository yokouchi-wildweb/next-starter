// src/features/setting/services/types.ts

import type { AdminConsoleRegistrationInput } from "@/features/user/services/server/registrations";

export type AdminSetupInput = Pick<
  AdminConsoleRegistrationInput,
  "displayName" | "email" | "localPassword"
> &
  Partial<Omit<AdminConsoleRegistrationInput, "displayName" | "email" | "localPassword">>;
