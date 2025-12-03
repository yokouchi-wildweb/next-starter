// src/features/wallet/entities/schemaRegistry.ts

import { z } from "zod";

export const WalletBaseSchema = z.object({
  user_id: z.string().trim().min(1, { message: "ユーザーは必須です。" }),
  type: z.enum(["regular_point", "temporary_point"]),
  balance: z.coerce.number().int().min(0).default(0),
  locked_balance: z.coerce.number().int().min(0).default(0),
});

export const WalletCreateSchema = WalletBaseSchema;

export const WalletUpdateSchema = WalletBaseSchema.partial();
