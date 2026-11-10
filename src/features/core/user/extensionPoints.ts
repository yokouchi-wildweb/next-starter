// src/features/core/user/extensionPoints.ts
// user の拡張点の宣言(リテラルだけ。pnpm generate extensions が読み ./extensions/<点>.ts を生成する)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // ロールの一覧: coreRoles/・roles/ の *.role.json から pnpm generate role が ./extensions/roles.ts を書く
  roles: { writer: "role:generate", side: "shared" },
  // 上書きの対象: core ロールの JSON。隣の <JSON の名前>.override.ts が書いてよい鍵(core ロールは無効にできない = enabled は無い)
  coreRoleDefinitions: {
    overrides: "src/features/core/user/coreRoles/*.role.json",
    export: "override",
    side: "shared",
    overrideOf: ["label", "hasProfile"],
  },
  // 上書きの対象: 足したロールの JSON。隣の <JSON の名前>.override.ts が書いてよい鍵
  roleDefinitions: {
    overrides: "src/features/core/user/roles/*.role.json",
    addable: true,
    export: "override",
    side: "shared",
    overrideOf: ["label", "hasProfile", "enabled"],
  },
  // 表示名の予約名プロバイダ: reservedNames/<名前>.ts の export const provider(上流の項目は 0)
  reservedNames: {
    dir: "reservedNames",
    export: "provider",
    type: { from: "@/features/core/user/types", name: "ReservedUserNameProvider" },
    side: "server",
  },
  // 退会・ソフトデリートの後片付け: cleanupHandlers/<名前>.ts の export const handler
  cleanupHandlers: {
    dir: "cleanupHandlers",
    export: "handler",
    type: { from: "@/features/core/user/services/server/cleanup", name: "UserCleanupItem" },
    side: "server",
    alwaysOn: true,
  },
  // 管理一覧の一括操作: adminBulkActions/<名前>.tsx の export const bulkAction(上流の既定 = タグの一括設定)。
  // fork は項目を足す・<名前>.override.ts で enabled・order を変える(D149)
  adminBulkActions: {
    dir: "adminBulkActions",
    export: "bulkAction",
    type: { from: "@/features/core/user/types", name: "UserAdminBulkActionItem" },
    side: "client",
    key: "key",
    overrideOf: ["enabled", "order"],
  },
  // マイページのメニュー: mypageMenu/items/<key>.ts の export const item(リンク / 操作の 2 形、上流は 10 刻みの order)。
  // fork は項目を足す・上流の項目は隣の <key>.override.ts で変える(書き方: README.md「マイページのメニュー」)
  mypageMenu: {
    dir: "mypageMenu/items",
    export: "item",
    type: { from: "@/features/core/user/types", name: "MypageMenuItem" },
    side: "client",
    key: "key",
    overrideOf: ["hidden", "order", "title", "description", "icon", "variant", "pendingTitle"],
  },
} as const;
