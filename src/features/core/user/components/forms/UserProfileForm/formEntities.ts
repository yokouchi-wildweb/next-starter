// src/features/core/user/components/forms/UserProfileForm/formEntities.ts

import { z } from "zod";

import type { User } from "@/features/user/entities";
import {
  createProfileDataValidator,
  getProfilesByCategory,
} from "@/features/core/userProfile/utils";

const displayNameSchema = z.string().trim();

// profileData バリデーション関数（selfEdit タグでフィルタリング）
const validateProfileData = createProfileDataValidator(
  getProfilesByCategory("user"),
  "selfEdit"
);

export const FormSchema = z
  .object({
    displayName: displayNameSchema,
    role: z.string(),
    profileData: z.record(z.unknown()).optional(),
  })
  .superRefine((value, ctx) => {
    validateProfileData(value, ctx);
  });

export type FormValues = {
  displayName: string;
  role: string;
  profileData?: Record<string, unknown>;
};

export const createDefaultValues = (
  user: User,
  profileData?: Record<string, unknown>
): FormValues => {
  return {
    displayName: user.displayName ?? "",
    role: user.role,
    profileData: profileData ?? {},
  };
};
