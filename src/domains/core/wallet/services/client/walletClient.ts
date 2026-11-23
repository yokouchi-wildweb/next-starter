// src/domains/wallet/services/client/walletClient.ts

import axios from "axios";

import { createApiClient } from "@/lib/crud";
import type { ApiClient } from "@/lib/crud";
import { normalizeHttpError } from "@/lib/errors";
import type { Wallet } from "@/domains/core/wallet/entities";
import type {
  WalletCreateFields,
  WalletUpdateFields,
} from "@/domains/core/wallet/entities/form";
import type {
  WalletAdjustmentResult,
  WalletAdjustRequestPayload,
  BulkAdjustByTypeResult,
  BulkGrantParams,
  BulkGrantResult,
  ExpiringLotsPayload,
} from "@/domains/core/wallet/services/types";
import type { WalletTypeValue } from "@/domains/core/wallet/types/field";

/** bulkAdjustByType のリクエストペイロード */
export type BulkAdjustByTypePayload = Omit<WalletAdjustRequestPayload, "requestBatchId"> & {
  requestBatchId?: string;
  role?: string;
};

type WalletClient = ApiClient<Wallet, WalletCreateFields, WalletUpdateFields> & {
  adjustBalance(userId: string, payload: WalletAdjustRequestPayload): Promise<WalletAdjustmentResult>;
  bulkAdjustByType(payload: BulkAdjustByTypePayload): Promise<BulkAdjustByTypeResult>;
  /** 選んだ利用者へのまとめての付与・補填(1 回 = userConfig.bulkUpdate.maxIds 人まで。分けて送るのは hook useBulkGrantWallet) */
  bulkGrant(params: BulkGrantParams): Promise<BulkGrantResult>;
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

async function bulkGrant(params: BulkGrantParams) {
  try {
    const response = await axios.post<BulkGrantResult>("/api/admin/wallet/bulk/grant", params);
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
  bulkGrant,
  getMyBalances,
  getMyExpiringLots,
};
