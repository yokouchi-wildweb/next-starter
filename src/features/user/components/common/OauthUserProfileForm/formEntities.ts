// src/features/user/components/common/OauthUserProfileForm/formEntities.ts

import { z } from "zod";

import type { User } from "@/features/user/entities";

export const FormSchema = z.object({
  displayName: z.string().trim().optional(),
});

export type FormValues = z.infer<typeof FormSchema>;

export function createDefaultValues(user: User): FormValues {
  return {
    displayName: user.displayName ?? "",
  };
}
