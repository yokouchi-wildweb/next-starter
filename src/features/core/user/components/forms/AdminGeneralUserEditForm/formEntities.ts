import { z } from "zod";

import type { User } from "@/features/user/entities";
import {
  createProfileDataValidator,
  getProfilesByCategory,
} from "@/features/core/userProfile/utils";

const nameSchema = z.string();

// profileData バリデーション関数（adminEdit タグでフィルタリング）
const validateProfileData = createProfileDataValidator(getProfilesByCategory("user"), "adminEdit");

export const FormSchema = z
  .object({
    name: nameSchema,
    role: z.string(),
    profileData: z.record(z.unknown()).optional(),
    user_tag_ids: z.array(z.string()).optional(),
  })
  .superRefine((value, ctx) => {
    validateProfileData(value, ctx);
  });

export type FormValues = {
  name: string;
  role: string;
  profileData?: Record<string, unknown>;
  user_tag_ids?: string[];
};

export const createDefaultValues = (
  user: User,
  profileData?: Record<string, unknown>,
): FormValues => {
  return {
    name: user.name ?? "",
    role: user.role ?? "user",
    profileData: profileData ?? {},
    user_tag_ids: user.user_tag_ids ?? [],
  };
};
