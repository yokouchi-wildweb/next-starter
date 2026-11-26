// src/domains/core/milestone/entities/milestone/schema.ts

import { requiredDatetime } from "@/lib/domain";
import { z } from "zod";

export const MilestoneBaseSchema = z.object({
  user_id: z.string().trim().min(1, { message: "ユーザーIDは必須です。" }),
  milestone_key: z.string().trim().min(1, { message: "マイルストーンキーは必須です。" }),
  achieved_at: requiredDatetime,
  metadata: z.unknown().nullish(),
});

export const MilestoneCreateSchema = MilestoneBaseSchema;

export const MilestoneUpdateSchema = MilestoneBaseSchema.partial();
