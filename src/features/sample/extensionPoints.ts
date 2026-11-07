// src/features/sample/extensionPoints.ts
// サンプルの拡張点の宣言(pnpm generate domain が生成する。生成のたびに書き直すので手で編集しない。
// 別の受け口が要るなら domain.json を generate: false にして手で持つ)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // 管理一覧の一括操作: adminBulkActions/<名前>.tsx の export const bulkAction(lib/crud の作成関数で数行。D149)
  adminBulkActions: {
    dir: "adminBulkActions",
    export: "bulkAction",
    type: { from: "@/features/sample/types/adminBulkAction", name: "SampleAdminBulkActionItem" },
    side: "client",
    key: "key",
    overrideOf: ["enabled", "order"],
  },
};
