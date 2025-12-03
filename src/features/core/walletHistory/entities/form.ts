// src/features/walletHistory/entities/form.ts

import { z } from "zod";
import { WalletHistoryCreateSchema, WalletHistoryUpdateSchema } from "./schema";

export type WalletHistoryCreateAdditional = {
  // foo: string; フォームに追加する項目
};
export type WalletHistoryCreateFields = z.infer<typeof WalletHistoryCreateSchema> & WalletHistoryCreateAdditional;

export type WalletHistoryUpdateAdditional = {
  // foo: string; フォームに追加する項目
};
export type WalletHistoryUpdateFields = z.infer<typeof WalletHistoryUpdateSchema> & WalletHistoryUpdateAdditional;
