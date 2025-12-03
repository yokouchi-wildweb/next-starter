// src/features/wallet/services/client/walletClient.ts

import axios from "axios";

import { createApiClient } from "@/lib/crud/apiClientFactory";
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
} from "@/features/core/wallet/services/types";

type WalletClient = ApiClient<Wallet, WalletCreateFields, WalletUpdateFields> & {
  adjustBalance(userId: string, payload: WalletAdjustRequestPayload): Promise<WalletAdjustmentResult>;
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

export const walletClient: WalletClient = {
  ...baseClient,
  adjustBalance,
};
