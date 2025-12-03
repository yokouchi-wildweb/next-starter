// src/features/wallet/services/client/walletClient.ts

import { createApiClient } from "@/lib/crud/apiClientFactory";
import type { ApiClient } from "@/lib/crud/types";
import type { Wallet } from "@/features/core/wallet/entities";
import type {
  WalletCreateFields,
  WalletUpdateFields,
} from "@/features/core/wallet/entities/form";

export const walletClient: ApiClient<
  Wallet,
  WalletCreateFields,
  WalletUpdateFields
> = createApiClient<
  Wallet,
  WalletCreateFields,
  WalletUpdateFields
>("/api/wallet");
