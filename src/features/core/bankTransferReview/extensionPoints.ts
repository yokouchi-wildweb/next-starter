// src/features/core/bankTransferReview/extensionPoints.ts
// bankTransferReview の拡張点の宣言(リテラルだけ。pnpm generate extensions が読み ./extensions/<点>.ts を生成する)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // 管理一覧の一括操作: adminBulkActions/<名前>.tsx の export const bulkAction(上流の既定 = メール一斉送信)。
  // fork は項目を足す(一括承認など)・<名前>.override.ts で enabled・order を変える(D149・D86)
  adminBulkActions: {
    dir: "adminBulkActions",
    export: "bulkAction",
    type: { from: "@/features/core/bankTransferReview/types/adminBulkAction", name: "BankTransferReviewAdminBulkActionItem" },
    side: "client",
    key: "key",
    overrideOf: ["enabled", "order"],
  },
};
