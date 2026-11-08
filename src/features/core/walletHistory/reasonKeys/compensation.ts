// src/features/core/walletHistory/reasonKeys/compensation.ts
// お詫び・補填(障害・不具合の埋め合わせに運用者が付ける)。区分は管理者調整(発行には数えない。返金 refund は本物の返金のために空けておく)。
// 書き手: walletService.bulkGrant(pnpm task wallet:bulk-grant -- --kind compensation)

import type { WalletReasonKeyItem } from "@/features/core/walletHistory/types/reasonKey";

export const reasonKey: WalletReasonKeyItem = {
  key: "compensation",
  label: "お詫び・補填",
  category: "admin_adjustment",
  sortOrder: 95,
};
