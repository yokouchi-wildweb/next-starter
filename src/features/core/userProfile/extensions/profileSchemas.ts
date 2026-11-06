// 生成物・編集不可: pnpm generate role が src/features/core/userProfile/extensionPoints.ts から生成する
// src/features/core/userProfile/extensions/profileSchemas.ts

import type { z } from "zod";
import { ContributorProfileSchema } from "@/features/core/userProfile/entities/profiles/contributor";

export const profileSchemas: Record<string, z.ZodType> = {
  contributor: ContributorProfileSchema,
};
