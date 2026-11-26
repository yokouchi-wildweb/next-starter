// src/domains/core/wallet/entities/wallet/schema.ts

import { walletConfig } from "@/domains/wallet/config";
import type { WalletType } from "@/domains/wallet/config";
import { z } from "zod";

// walletConfig.currency から動的に walletType の値を取得
const walletTypes = Object.keys(walletConfig.currency) as [WalletType, ...WalletType[]];
export const WalletBaseSchema = z.object({
  user_id: z.string().trim().min(1, { message: "ユーザーは必須です。" }),
  type: z.enum(walletTypes),
  balance: z.coerce.number().int().min(0).default(0),
  locked_balance: z.coerce.number().int().min(0).default(0),
});
export const WalletCreateSchema = WalletBaseSchema;
export const WalletUpdateSchema = WalletBaseSchema.partial();
