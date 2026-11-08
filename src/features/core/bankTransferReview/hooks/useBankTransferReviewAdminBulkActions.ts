// src/features/core/bankTransferReview/hooks/useBankTransferReviewAdminBulkActions.ts
// 振込レビューの管理一覧に出す一括操作の項目(受け口 adminBulkActions を、enabled・access で絞って並べる)

"use client";

import { useMemo } from "react";

import { selectBulkActions } from "@/lib/tableSuite";
import { adminBulkActions } from "@/features/core/bankTransferReview/extensions/adminBulkActions";
import type { BankTransferReviewAdminBulkActionItem } from "@/features/core/bankTransferReview/types/adminBulkAction";
import { useAdminBulkActionCan } from "@/features/core/user/hooks/useAdminBulkActionCan";

export function useBankTransferReviewAdminBulkActions(): BankTransferReviewAdminBulkActionItem[] {
  const can = useAdminBulkActionCan();
  return useMemo(() => selectBulkActions(Object.values(adminBulkActions), { can }), [can]);
}
