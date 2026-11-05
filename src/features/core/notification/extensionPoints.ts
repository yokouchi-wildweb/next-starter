// src/features/core/notification/extensionPoints.ts
// notification の拡張点の宣言(リテラルだけ。pnpm extensions:generate が読み ./extensions/<点>.ts を生成する)。書式: scripts/extensions/README.md

export const extensionPoints = {
  // 管理一覧の一括操作: adminBulkActions/<名前>.tsx の export const bulkAction(上流の既定 = 一括削除)。
  // fork は項目を足す・<名前>.override.ts で enabled・order を変える(D149)
  adminBulkActions: {
    dir: "adminBulkActions",
    export: "bulkAction",
    type: { from: "@/features/core/notification/types/adminBulkAction", name: "NotificationAdminBulkActionItem" },
    side: "client",
    key: "key",
    overrideOf: ["enabled", "order"],
  },
};
