// src/features/gachaMachine/entities/schemaRegistry.ts

import { emptyToNull } from "@/utils/string";
import { z } from "zod";

export const GachaMachineBaseSchema = z.object({
  name: z.string().trim().min(1, { message: "マシン名は必須です。" }),
  main_image_url: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  play_cost: z.coerce.number().int(),
  sale_start_at: z.preprocess(
  (value) => {
    if (value == null) return undefined;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      return trimmed;
    }
    return value;
  },
  z.coerce.date()
).or(z.literal("").transform(() => undefined)).nullish(),
  sale_end_at: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  daily_limit: z.coerce.number().int().nullish(),
  user_limit: z.coerce.number().int().nullish(),
  play_button_type: z.array(z.string()).default([]),
  description: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
});

export const GachaMachineCreateSchema = GachaMachineBaseSchema;

export const GachaMachineUpdateSchema = GachaMachineBaseSchema.partial();
