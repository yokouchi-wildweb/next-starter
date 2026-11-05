// src/features/core/walletHistory/reasonKeys/adminAdjustment.ts
// 管理者の残高調整(管理画面の個別・一括の調整の既定の種類。区分 admin_adjustment の固定キー)。
// 書き手: src/app/api/admin/wallet/[userId]/adjust・bulk/adjust-by-type、一括の job

import type { WalletReasonKeyItem } from "@/features/core/walletHistory/types/reasonKey";

export const reasonKey: WalletReasonKeyItem = {
  key: "admin_adjustment",
  label: "管理者調整",
  category: "admin_adjustment",
  sortOrder: 90,
};
