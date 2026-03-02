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
} from "@/features/core/wallet/services/types";

/** bulkAdjustByType のリクエストペイロード */
export type BulkAdjustByTypePayload = Omit<WalletAdjustRequestPayload, "requestBatchId"> & {
  requestBatchId?: string;
  role?: string;
};

type WalletClient = ApiClient<Wallet, WalletCreateFields, WalletUpdateFields> & {
  adjustBalance(userId: string, payload: WalletAdjustRequestPayload): Promise<WalletAdjustmentResult>;
  bulkAdjustByType(payload: BulkAdjustByTypePayload): Promise<BulkAdjustByTypeResult>;
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

export const walletClient: WalletClient = {
  ...baseClient,
  adjustBalance,
  bulkAdjustByType,
};
