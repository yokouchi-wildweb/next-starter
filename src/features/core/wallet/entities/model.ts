// src/features/wallet/entities/model.ts

import type { WalletType } from "@/config/app/currency.config";

export type Wallet = {
  id: string;
  user_id: string;
  type: WalletType;
  balance: number;
  locked_balance: number;
  updatedAt: Date | null;
};
