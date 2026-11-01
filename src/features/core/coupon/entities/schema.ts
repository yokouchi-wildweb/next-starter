// src/features/coupon/entities/schemaRegistry.ts

import { nullableDatetime } from "@/lib/crud/utils/schema";
import { emptyToNull } from "@/utils/string";
import { storageMediaValueSchema } from "@/lib/storage/schema";
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
    .transform((value) => emptyToNull(value))
    .pipe(storageMediaValueSchema.nullish()),
  admin_label: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  admin_note: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  valid_from: nullableDatetime.nullish(),
  valid_until: nullableDatetime.nullish(),
  max_total_uses: z.coerce.number().int().nullish(),
  max_uses_per_redeemer: z.coerce.number().int().nullish(),
  settings: z.record(z.string(), z.unknown()).default({}),
  deletedAt: z.date().nullish(),
});

export const CouponCreateSchema = CouponBaseSchema.omit({ deletedAt: true });

export const CouponUpdateSchema = CouponBaseSchema.partial().omit({ deletedAt: true });
