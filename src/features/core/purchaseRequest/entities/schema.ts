// src/features/purchaseRequest/entities/schemaRegistry.ts

import { emptyToNull } from "@/utils/string";
import { z } from "zod";
import { CURRENCY_CONFIG, type WalletType } from "@/config/app/currency.config";
import { nullableDatetime } from "@/lib/crud/utils";

// CURRENCY_CONFIG から動的に walletType の値を取得
const walletTypes = Object.keys(CURRENCY_CONFIG) as [WalletType, ...WalletType[]];

export const PurchaseRequestBaseSchema = z.object({
  user_id: z.string().trim().min(1, { message: "ユーザーは必須です。" }),
  wallet_history_id: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  idempotency_key: z.string().trim().min(1, { message: "冪等キーは必須です。" }),
  wallet_type: z.enum(walletTypes),
  amount: z.coerce.number().int(),
  payment_amount: z.coerce.number().int(),
  payment_method: z.string().trim().min(1, { message: "支払い方法は必須です。" }),
  status: z.enum(["pending", "processing", "completed", "failed", "expired"]),
  payment_provider: z.string().trim().min(1, { message: "決済プロバイダは必須です。" }),
  payment_session_id: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  transaction_id: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  redirect_url: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  error_code: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  error_message: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  webhook_signature: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  coupon_code: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  discount_amount: z.coerce.number().int().nullish(),
  original_payment_amount: z.coerce.number().int().nullish(),
  completed_at: nullableDatetime.nullish(),
  paid_at: nullableDatetime.nullish(),
  expires_at: nullableDatetime.nullish(),
});

export const PurchaseRequestCreateSchema = PurchaseRequestBaseSchema;

export const PurchaseRequestUpdateSchema = PurchaseRequestBaseSchema.partial();
