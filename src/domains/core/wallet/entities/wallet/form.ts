// src/domains/core/wallet/entities/wallet/form.ts

import { WalletCreateSchema, WalletUpdateSchema } from "./schema";
import { z } from "zod";

export type WalletCreateAdditional = {
  // foo: string; フォームに追加する項目
};
export type WalletCreateFields = z.infer<typeof WalletCreateSchema> & WalletCreateAdditional;
export type WalletUpdateAdditional = {
  // foo: string; フォームに追加する項目
};
export type WalletUpdateFields = z.infer<typeof WalletUpdateSchema> & WalletUpdateAdditional;
