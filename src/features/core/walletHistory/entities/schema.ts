// src/features/walletHistory/entities/schemaRegistry.ts

import { emptyToNull } from "@/utils/string";
import { z } from "zod";
import { CURRENCY_CONFIG, type WalletType } from "@/config/app/currency.config";
import { REASON_CATEGORY_VALUES, DEFAULT_REASON_CATEGORY } from "@/config/app/reason-category.config";

// CURRENCY_CONFIG から動的に walletType の値を取得
const walletTypes = Object.keys(CURRENCY_CONFIG) as [WalletType, ...WalletType[]];

export const WalletHistoryMetaSchema = z
  .object({
    productId: z.string().trim().nullish().transform(emptyToNull).optional(),
    orderId: z.string().trim().nullish().transform(emptyToNull).optional(),
    gachaId: z.string().trim().nullish().transform(emptyToNull).optional(),
    adminId: z.string().trim().nullish().transform(emptyToNull).optional(),
    sourceScreen: z.string().trim().nullish().transform(emptyToNull).optional(),
    notes: z.string().trim().nullish().transform(emptyToNull).optional(),
  })
  .catchall(z.unknown())
  .partial();

export const WalletHistoryBaseSchema = z.object({
  user_id: z.string().trim().min(1, { message: "ユーザーは必須です。" }),
  type: z.enum(walletTypes),
  change_method: z.enum(["INCREMENT", "DECREMENT", "SET"]),
  points_delta: z.coerce.number().int().nonnegative(),
  balance_before: z.coerce.number().int(),
  balance_after: z.coerce.number().int(),
  source_type: z.enum(["user_action", "admin_action", "system"]),
  request_batch_id: z
    .string()
    .trim()
    .nullish()
    .transform((value) => emptyToNull(value)),
  reason: z
    .string()
    .trim()
    .nullish()
    .transform((value) => emptyToNull(value)),
  reason_category: z.enum(REASON_CATEGORY_VALUES).default(DEFAULT_REASON_CATEGORY),
  meta: WalletHistoryMetaSchema.nullish().transform((value) => value ?? null),
});

export const WalletHistoryCreateSchema = WalletHistoryBaseSchema;

export const WalletHistoryUpdateSchema = WalletHistoryBaseSchema.partial();
