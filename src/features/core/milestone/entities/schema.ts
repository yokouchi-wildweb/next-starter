// src/features/milestone/entities/schemaRegistry.ts

import { z } from "zod";

export const MilestoneBaseSchema = z.object({

});

export const MilestoneCreateSchema = MilestoneBaseSchema;

export const MilestoneUpdateSchema = MilestoneBaseSchema.partial();
