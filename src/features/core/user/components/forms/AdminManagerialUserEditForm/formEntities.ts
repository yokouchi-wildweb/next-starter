import { z } from "zod";

import type { User } from "@/features/user/entities";
import { UserNameFormSchema } from "@/features/core/user/entities/userName";
import {
  createProfileDataValidator,
  getProfilesByCategory,
} from "@/features/core/userProfile/utils";

const nameSchema = UserNameFormSchema;

// profileData バリデーション関数（adminEdit タグでフィルタリング）
const validateProfileData = createProfileDataValidator(getProfilesByCategory("admin"), "adminEdit");

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
  profileData?: Record<string, unknown>,
): FormValues => {
  return {
    name: user.name ?? "",
    role: user.role ?? "admin",
    profileData: profileData ?? {},
  };
};
