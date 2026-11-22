// src/domains/walletHistory/services/client/walletHistoryClient.ts

import { createApiClient } from "@/lib/crud";
import type { ApiClient } from "@/lib/crud";
import type { WalletHistory } from "@/domains/core/walletHistory/entities";
import type {
  WalletHistoryCreateFields,
  WalletHistoryUpdateFields,
} from "@/domains/core/walletHistory/entities/form";

export const walletHistoryClient: ApiClient<
  WalletHistory,
  WalletHistoryCreateFields,
  WalletHistoryUpdateFields
> = createApiClient<
  WalletHistory,
  WalletHistoryCreateFields,
  WalletHistoryUpdateFields
>("/api/walletHistory");
