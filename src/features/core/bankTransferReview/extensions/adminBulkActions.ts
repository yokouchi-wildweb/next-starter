// 生成物・編集不可: pnpm generate extensions が src/features/core/bankTransferReview/extensionPoints.ts から生成する
// adminBulkActions: src/features/core/bankTransferReview/adminBulkActions/<名前>.ts(x) か <名前>/index.ts(x) の export const bulkAction(並びはファイル名の順)

import type { BankTransferReviewAdminBulkActionItem } from "@/features/core/bankTransferReview/types/adminBulkAction";

import { bulkAction as adminBulkActions_sendEmail } from "@/features/core/bankTransferReview/adminBulkActions/sendEmail";

const adminBulkActionsList: BankTransferReviewAdminBulkActionItem[] = [
  adminBulkActions_sendEmail,
];
export const adminBulkActions: Readonly<Record<string, BankTransferReviewAdminBulkActionItem>> = Object.assign(Object.create(null), Object.fromEntries(adminBulkActionsList.map((item) => [String(item.key), item])));
if (Object.keys(adminBulkActions).length !== adminBulkActionsList.length) throw new Error("adminBulkActions: key が重複している項目がある");
