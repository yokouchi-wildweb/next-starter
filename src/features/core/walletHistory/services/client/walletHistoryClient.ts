// src/features/walletHistory/services/client/walletHistoryClient.ts

import { createApiClient } from "@/lib/crud/apiClientFactory";
import type { ApiClient } from "@/lib/crud/types";
import type { WalletHistory } from "@/features/core/walletHistory/entities";
import type {
  WalletHistoryCreateFields,
  WalletHistoryUpdateFields,
} from "@/features/core/walletHistory/entities/form";

export const walletHistoryClient: ApiClient<
  WalletHistory,
  WalletHistoryCreateFields,
  WalletHistoryUpdateFields
> = createApiClient<
  WalletHistory,
  WalletHistoryCreateFields,
  WalletHistoryUpdateFields
>("/api/walletHistory");
