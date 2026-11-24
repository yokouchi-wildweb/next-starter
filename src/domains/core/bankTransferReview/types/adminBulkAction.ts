// src/domains/core/bankTransferReview/types/adminBulkAction.ts

import type { AdminBulkActionItemOf } from "@/domains/core/admin/types/adminBulkAction";
import type { AdminBankTransferReviewListItem } from "@/domains/core/bankTransferReview/services/client/bankTransferReviewClient";

/**
 * 振込レビューの管理一覧の一括操作の項目(src/domains/core/bankTransferReview/plugs/adminBulkActions/<名前>.tsx の export const bulkAction。
 * fork は自分のドメインの plugs/adminBulkActions/<名前>.tsx に置き domain: "bankTransferReview")。
 * 一覧は status ごとのタブだが受け口は 1 つなので lists は使わない(今のタブで出し分けたいときは Component の中で selection を見る)。
 * 作り方: src/lib/tableSuite/README.md「一括操作の受け口」
 */
export type BankTransferReviewAdminBulkActionItem = AdminBulkActionItemOf<AdminBankTransferReviewListItem>;
