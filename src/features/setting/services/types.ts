// src/features/setting/services/types.ts

import type { AdminConsoleRegistrationInput } from "@/features/user/services/server/registrations";

export type AdminSetupInput = Pick<
  AdminConsoleRegistrationInput,
  "displayName" | "email" | "password"
> &
  Partial<Omit<AdminConsoleRegistrationInput, "displayName" | "email" | "password">>;
