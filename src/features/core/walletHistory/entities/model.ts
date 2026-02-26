// src/features/walletHistory/entities/model.ts

import type { WalletHistoryMeta } from "@/features/core/walletHistory/types/meta";
import type { WalletType } from "@/config/app/currency.config";
import type { ReasonCategory } from "@/config/app/wallet-reason-category.config";

export type WalletHistory = {
  id: string;
  user_id: string;
  type: WalletType;
  change_method: "INCREMENT" | "DECREMENT" | "SET";
  points_delta: number;
  balance_before: number;
  balance_after: number;
  source_type: "user_action" | "admin_action" | "system";
  request_batch_id: string | null;
  reason: string | null;
  reason_category: ReasonCategory;
  meta: WalletHistoryMeta | null;
  createdAt: Date | null;
};
