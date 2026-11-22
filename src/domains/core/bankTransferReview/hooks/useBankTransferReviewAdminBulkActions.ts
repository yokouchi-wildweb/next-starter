// src/domains/core/bankTransferReview/hooks/useBankTransferReviewAdminBulkActions.ts
// 振込レビューの管理一覧に出す一括操作の項目(点 adminBulkActions のこのドメインの項目を、enabled・access で絞って並べる。門番で閉じた項目は外れる)

"use client";

import { useMemo } from "react";

import { selectBulkActions } from "@/lib/tableSuite";
import { useDomainAdminBulkActions } from "@/domains/core/admin/hooks/useDomainAdminBulkActions";
import type { BankTransferReviewAdminBulkActionItem } from "@/domains/core/bankTransferReview/types/adminBulkAction";
import { useAdminBulkActionCan } from "@/domains/core/user/hooks/useAdminBulkActionCan";

export function useBankTransferReviewAdminBulkActions(): BankTransferReviewAdminBulkActionItem[] {
  const can = useAdminBulkActionCan();
  const items = useDomainAdminBulkActions<BankTransferReviewAdminBulkActionItem>("bankTransferReview");
  return useMemo(() => selectBulkActions(items, { can }), [items, can]);
}
