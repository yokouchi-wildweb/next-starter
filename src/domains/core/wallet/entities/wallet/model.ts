// src/domains/core/wallet/entities/wallet/model.ts

import type { WalletType } from "@/domains/wallet/config";

export type Wallet = {
  id: string;
  user_id: string;
  type: WalletType;
  balance: number;
  locked_balance: number;
  updatedAt: Date | null;
};
