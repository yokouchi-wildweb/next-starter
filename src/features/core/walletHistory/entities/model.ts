// src/features/walletHistory/entities/model.ts

import type { WalletHistoryMeta } from "@/features/core/walletHistory/types/meta";

export type WalletHistory = {
  id: string;
  user_id: string;
  type: "regular_point" | "temporary_point";
  change_method: "INCREMENT" | "DECREMENT" | "SET";
  points_delta: number;
  balance_before: number;
  balance_after: number;
  source_type: "user_action" | "admin_action" | "system";
  request_batch_id: string | null;
  reason: string | null;
  meta: WalletHistoryMeta | null;
  createdAt: Date | null;
};
