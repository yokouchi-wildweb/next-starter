// src/features/coupon/entities/schemaRegistry.ts

import { emptyToNull } from "@/utils/string";
import { z } from "zod";

export const CouponBaseSchema = z.object({
  category: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  code: z.string().trim().min(1, { message: "クーポンコードは必須です。" }),
  type: z.enum(["official", "affiliate", "invite"]),
  status: z.enum(["active", "inactive"]),
  name: z.string().trim().min(1, { message: "クーポン名は必須です。" }),
  description: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  image_url: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  admin_label: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  admin_note: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  valid_from: z.preprocess(
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
  valid_until: z.preprocess(
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
  max_total_uses: z.coerce.number().int().nullish(),
  max_uses_per_redeemer: z.coerce.number().int().nullish(),
  deletedAt: z.date().nullish(),
});

export const CouponCreateSchema = CouponBaseSchema.omit({ deletedAt: true });

export const CouponUpdateSchema = CouponBaseSchema.partial().omit({ deletedAt: true });
