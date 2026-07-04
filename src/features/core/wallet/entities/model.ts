// src/features/wallet/entities/model.ts

import type { WalletType } from "@/config/app/currency.config";

export type Wallet = {
  id: string;
  user_id: string;
  type: WalletType;
  balance: number;
  locked_balance: number;
  updatedAt: Date | null;
};

/** ウォレットロット（付与単位の台帳。有効期限が有効な walletType のみ） */
export type WalletLot = {
  id: string;
  wallet_id: string;
  granted_amount: number;
  remaining: number;
  expires_at: Date;
  createdAt: Date | null;
};
