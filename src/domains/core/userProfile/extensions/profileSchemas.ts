// 生成物・編集不可: pnpm generate role が src/domains/core/userProfile/extensionPoints.ts から生成する
// src/domains/core/userProfile/extensions/profileSchemas.ts

import type { z } from "zod";
import { ContributorProfileSchema } from "@/domains/core/userProfile/entities/profiles/contributor";

export const profileSchemas: Record<string, z.ZodType> = {
  contributor: ContributorProfileSchema,
};
