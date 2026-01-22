// src/features/core/user/components/forms/UserProfileForm/formEntities.ts

import { z } from "zod";

import type { User } from "@/features/user/entities";
import {
  createProfileDataValidator,
  getProfilesByCategory,
} from "@/features/core/userProfile/utils";

const nameSchema = z.string().trim();

// profileData バリデーション関数（selfEdit タグでフィルタリング）
const validateProfileData = createProfileDataValidator(
  getProfilesByCategory("user"),
  "selfEdit"
);

export const FormSchema = z
  .object({
    name: nameSchema,
    role: z.string(),
    profileData: z.record(z.unknown()).optional(),
  })
  .superRefine((value, ctx) => {
    validateProfileData(value, ctx);
  });

export type FormValues = {
  name: string;
  role: string;
  profileData?: Record<string, unknown>;
};

export const createDefaultValues = (
  user: User,
  profileData?: Record<string, unknown>
): FormValues => {
  return {
    name: user.name ?? "",
    role: user.role,
    profileData: profileData ?? {},
  };
};
