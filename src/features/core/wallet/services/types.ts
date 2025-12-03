// src/features/wallet/services/types.ts

import type { Wallet } from "@/features/core/wallet/entities";
import type { WalletTypeValue } from "@/features/core/wallet/types/field";
import type { WalletHistory } from "@/features/core/walletHistory/entities";
import type { WalletHistoryChangeMethodValue, WalletHistorySourceTypeValue } from "@/features/core/walletHistory/types/field";
import type { WalletHistoryMetaInput } from "@/features/core/walletHistory/types/meta";

export type WalletAdjustmentResult = {
  wallet: Wallet;
  history: WalletHistory;
};

export type AdjustWalletParams = {
  userId: string;
  walletType: WalletTypeValue;
  changeMethod: WalletHistoryChangeMethodValue;
  amount: number;
  sourceType: WalletHistorySourceTypeValue;
  requestBatchId?: string | null;
  reason?: string | null;
  meta?: WalletHistoryMetaInput;
};

export type ReserveWalletParams = {
  userId: string;
  walletType: WalletTypeValue;
  amount: number;
};

export type ReleaseReservationParams = ReserveWalletParams;

export type ConsumeReservationParams = {
  userId: string;
  walletType: WalletTypeValue;
  amount: number;
  sourceType: WalletHistorySourceTypeValue;
  requestBatchId?: string | null;
  reason?: string | null;
  meta?: WalletHistoryMetaInput;
};
