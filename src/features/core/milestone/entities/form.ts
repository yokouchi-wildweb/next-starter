// src/features/milestone/entities/form.ts

import { z } from "zod";
import { MilestoneCreateSchema, MilestoneUpdateSchema } from "./schema";

export type MilestoneCreateAdditional = {
  // foo: string; フォームに追加する項目
};
export type MilestoneCreateFields = z.infer<typeof MilestoneCreateSchema> & MilestoneCreateAdditional;

export type MilestoneUpdateAdditional = {
  // foo: string; フォームに追加する項目
};
export type MilestoneUpdateFields = z.infer<typeof MilestoneUpdateSchema> & MilestoneUpdateAdditional;
