// src/features/wallet/entities/form.ts

import { z } from "zod";
import { WalletCreateSchema, WalletUpdateSchema } from "./schema";

export type WalletCreateAdditional = {
  // foo: string; フォームに追加する項目
};
export type WalletCreateFields = z.infer<typeof WalletCreateSchema> & WalletCreateAdditional;

export type WalletUpdateAdditional = {
  // foo: string; フォームに追加する項目
};
export type WalletUpdateFields = z.infer<typeof WalletUpdateSchema> & WalletUpdateAdditional;
