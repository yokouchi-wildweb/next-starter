// src/features/core/wallet/presenters.ts

import type { Wallet } from "@/features/core/wallet/entities";
import type { FieldPresenter } from "@/lib/crud/presenters";
import { formatNumber, formatString } from "@/lib/crud/presenters";

export type WalletFieldPresenter = FieldPresenter<Wallet>;

export const presenters: Record<string, WalletFieldPresenter> = {
  type: ({ value }) => formatString(value),
  balance: ({ value }) => formatNumber(value),
  locked_balance: ({ value }) => formatNumber(value),
  user_id: ({ value }) => formatString(value),
  updatedAt: ({ value }) => formatString(value),
};

export default presenters;
