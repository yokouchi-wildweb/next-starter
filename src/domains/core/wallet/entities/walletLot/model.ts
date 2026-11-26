// src/domains/core/wallet/entities/walletLot/model.ts

/** ウォレットロット（付与単位の台帳。有効期限が有効な walletType のみ） */
export type WalletLot = {
  id: string;
  wallet_id: string;
  granted_amount: number;
  remaining: number;
  expires_at: Date;
  createdAt: Date | null;
};
