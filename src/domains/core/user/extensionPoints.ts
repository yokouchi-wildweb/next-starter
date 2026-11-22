// src/domains/core/user/extensionPoints.ts
// user の拡張点の宣言(リテラルだけ。pnpm generate extensions が読み ./extensions/<点>.ts を生成する)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // ロールの一覧: coreRoles/・roles/ の *.role.json から pnpm generate role が ./extensions/roles.ts を書く
  roles: { change: "add", writer: "role:generate", side: "shared" },
  // 上書きの対象: core ロールの JSON。隣の <JSON の名前>.override.ts が書いてよい鍵(core ロールは無効にできない = enabled は無い)
  coreRoleDefinitions: {
    change: "override",
    overrides: "src/domains/core/user/coreRoles/*.role.json",
    export: "override",
    side: "shared",
    overrideOf: ["label", "hasProfile"],
  },
  // 上書きの対象: 足したロールの JSON。隣の <JSON の名前>.override.ts が書いてよい鍵
  roleDefinitions: {
    change: "override",
    overrides: "src/domains/core/user/roles/*.role.json",
    addable: true,
    export: "override",
    side: "shared",
    overrideOf: ["label", "hasProfile", "enabled"],
  },
  // 表示名の予約名プロバイダ: <ドメイン>/plugs/userReservedNames/<名前>.ts の export const provider(上流の項目は 0)
  userReservedNames: {
    change: "add",
    plugs: true,
    export: "provider",
    type: { from: "@/domains/core/user/types", name: "ReservedUserNameProvider" },
    side: "server",
  },
  // 退会・ソフトデリートの後片付け: <ドメイン>/plugs/userCleanupHandlers/<名前>.ts の export const handler
  userCleanupHandlers: {
    change: "add",
    plugs: true,
    export: "handler",
    type: { from: "@/domains/core/user/services/server/cleanup", name: "UserCleanupItem" },
    side: "server",
    alwaysOn: true,
  },
  // 管理のユーザー管理モーダルのタブ: <ドメイン>/plugs/userAdminManageTabs/<名前>.tsx の export const tab(上流の項目は 0)。
  // 上流の 6 つのタブの後ろに order → key の順で並ぶ。上流のタブは置き換えない(書き方: Extension.md「管理のユーザー管理モーダルのタブ(拡張点 userAdminManageTabs)」)
  userAdminManageTabs: {
    change: "add",
    plugs: true,
    export: "tab",
    type: { from: "@/domains/core/user/types", name: "UserAdminManageTabItem" },
    side: "client",
    key: "key",
  },
  // マイページのメニュー: <ドメイン>/plugs/userMypageMenu/<key>.ts の export const item(リンク / 操作の 2 形、上流は 10 刻みの order)。
  // fork は項目を足す・上流の項目は隣の <key>.override.ts で変える(書き方: Extension.md「マイページのメニュー(拡張点 userMypageMenu)」)
  userMypageMenu: {
    change: "add",
    plugs: true,
    export: "item",
    type: { from: "@/domains/core/user/types", name: "MypageMenuItem" },
    side: "client",
    key: "key",
    overrideOf: ["hidden", "order", "title", "description", "icon", "variant", "pendingTitle"],
  },
} as const;

// 常設(どの機能の規則にも載らず常に開く、明示の宣言 D22・D53)。規則の domains に載せると地区の地図の生成で止まる
export const alwaysOpen = true;
