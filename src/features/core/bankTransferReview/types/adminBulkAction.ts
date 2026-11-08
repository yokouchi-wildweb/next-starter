// src/features/core/bankTransferReview/types/adminBulkAction.ts

import type { BulkActionItem } from "@/lib/tableSuite";
import type { AdminBankTransferReviewListItem } from "@/features/core/bankTransferReview/services/client/bankTransferReviewClient";
import type { AdminBulkActionAccess } from "@/features/core/user/types";

/**
 * 振込レビューの管理一覧の一括操作の項目(src/features/core/bankTransferReview/adminBulkActions/<名前>.tsx の export const bulkAction)。
 * 一覧は status ごとのタブだが受け口は 1 つなので lists は使わない(今のタブで出し分けたいときは Component の中で selection を見る)。
 * 作り方: src/lib/tableSuite/README.md「一括操作の受け口」
 */
export type BankTransferReviewAdminBulkActionItem = BulkActionItem<AdminBankTransferReviewListItem, AdminBulkActionAccess>;
