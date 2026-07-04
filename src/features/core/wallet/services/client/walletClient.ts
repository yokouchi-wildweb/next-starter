// src/features/wallet/services/client/walletClient.ts

import axios from "axios";

import { createApiClient } from "@/lib/crud";
import type { ApiClient } from "@/lib/crud/types";
import { normalizeHttpError } from "@/lib/errors";
import type { Wallet } from "@/features/core/wallet/entities";
import type {
  WalletCreateFields,
  WalletUpdateFields,
} from "@/features/core/wallet/entities/form";
import type {
  WalletAdjustmentResult,
  WalletAdjustRequestPayload,
  BulkAdjustByTypeResult,
  ExpiringLotsPayload,
} from "@/features/core/wallet/services/types";
import type { WalletTypeValue } from "@/features/core/wallet/types/field";

/** bulkAdjustByType のリクエストペイロード */
export type BulkAdjustByTypePayload = Omit<WalletAdjustRequestPayload, "requestBatchId"> & {
  requestBatchId?: string;
  role?: string;
};

type WalletClient = ApiClient<Wallet, WalletCreateFields, WalletUpdateFields> & {
  adjustBalance(userId: string, payload: WalletAdjustRequestPayload): Promise<WalletAdjustmentResult>;
  bulkAdjustByType(payload: BulkAdjustByTypePayload): Promise<BulkAdjustByTypeResult>;
  /** 本人のウォレット残高を取得（オーナーシップはサーバーが session で強制） */
  getMyBalances(): Promise<{ wallets: Wallet[] }>;
  /** 本人の失効間近残高を取得（有効期限が無効な通貨では常に空） */
  getMyExpiringLots(walletType: WalletTypeValue, withinDays?: number): Promise<ExpiringLotsPayload>;
};

const baseClient = createApiClient<Wallet, WalletCreateFields, WalletUpdateFields>("/api/wallet");

async function adjustBalance(userId: string, payload: WalletAdjustRequestPayload) {
  try {
    const response = await axios.post<WalletAdjustmentResult>(`/api/admin/wallet/${userId}/adjust`, payload);
    return response.data;
  } catch (error) {
    throw normalizeHttpError(error);
  }
}

async function bulkAdjustByType(payload: BulkAdjustByTypePayload) {
  try {
    const response = await axios.post<BulkAdjustByTypeResult>("/api/admin/wallet/bulk/adjust-by-type", payload);
    return response.data;
  } catch (error) {
    throw normalizeHttpError(error);
  }
}

async function getMyBalances(): Promise<{ wallets: Wallet[] }> {
  try {
    const response = await axios.get<{ wallets: Wallet[] }>("/api/me/wallet");
    return response.data;
  } catch (error) {
    throw normalizeHttpError(error);
  }
}

async function getMyExpiringLots(
  walletType: WalletTypeValue,
  withinDays?: number,
): Promise<ExpiringLotsPayload> {
  try {
    const response = await axios.get<ExpiringLotsPayload>("/api/me/wallet/expiring", {
      params: { walletType, ...(withinDays != null ? { withinDays } : {}) },
    });
    return response.data;
  } catch (error) {
    throw normalizeHttpError(error);
  }
}

export const walletClient: WalletClient = {
  ...baseClient,
  adjustBalance,
  bulkAdjustByType,
  getMyBalances,
  getMyExpiringLots,
};
