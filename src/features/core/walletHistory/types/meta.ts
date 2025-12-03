// src/features/walletHistory/types/meta.ts

export type WalletHistoryMeta = {
  productId?: string;
  orderId?: string;
  gachaId?: string;
  adminId?: string;
  sourceScreen?: string;
  notes?: string;
} & Record<string, unknown>;

export type WalletHistoryMetaInput = WalletHistoryMeta | null | undefined;
