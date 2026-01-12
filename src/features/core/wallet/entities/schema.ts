// src/features/wallet/entities/schemaRegistry.ts

import { z } from "zod";
import { CURRENCY_CONFIG, type WalletType } from "@/config/app/currency.config";

// CURRENCY_CONFIG から動的に walletType の値を取得
const walletTypes = Object.keys(CURRENCY_CONFIG) as [WalletType, ...WalletType[]];

export const WalletBaseSchema = z.object({
  user_id: z.string().trim().min(1, { message: "ユーザーは必須です。" }),
  type: z.enum(walletTypes),
  balance: z.coerce.number().int().min(0).default(0),
  locked_balance: z.coerce.number().int().min(0).default(0),
});

export const WalletCreateSchema = WalletBaseSchema;

export const WalletUpdateSchema = WalletBaseSchema.partial();
