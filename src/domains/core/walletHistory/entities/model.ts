// src/domains/walletHistory/entities/model.ts

import type { WalletHistoryMeta } from "@/domains/core/walletHistory/types/meta";
import type { WalletType } from "@/domains/wallet/config";
import type { ReasonCategory } from "@/domains/walletHistory/config";

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
  /** 付与の種類(点 walletHistoryReasonKeys の key。null = 種類なし) */
  reason_key: string | null;
  meta: WalletHistoryMeta | null;
  createdAt: Date | null;
};
