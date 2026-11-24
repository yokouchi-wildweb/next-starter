// src/domains/core/admin/extensionPoints.ts
// admin の拡張点の宣言(リテラルだけ。pnpm generate extensions が読み ./extensions/<点>.ts を生成する)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // 管理メニューのカテゴリー: 差す側の <ドメイン>/plugs/adminMenuCategories/<key>.ts の export const category。fork は自分のドメインに足し、上流の物は隣の <key>.override.ts で変える
  adminMenuCategories: {
    change: "add",
    plugs: true,
    export: "category",
    type: { from: "@/domains/core/admin/menu/types", name: "AdminMenuCategoryDefinition" },
    side: "client",
    key: "key",
    overrideOf: ["hidden", "label", "icon", "allowRoles", "order"],
  },
  // 管理メニューの項目: 差す側の <ドメイン>/plugs/adminMenuItems/<key>.ts の export const item(link / domain / source の 3 形)。項目のドメインが閉じれば出ない。上流の物は隣の <key>.override.ts で変える
  adminMenuItems: {
    change: "add",
    plugs: true,
    export: "item",
    type: { from: "@/domains/core/admin/menu/types", name: "AdminMenuItemDefinition" },
    side: "client",
    key: "key",
    overrideOf: ["hidden", "label", "icon", "allowRoles", "order", "category"],
  },
  // 管理ダッシュボードのセクション: 差す側の <ドメイン>/plugs/adminDashboardSections/<key>.ts(x) の export const section(描画 Section と取得 load を 1 つの定義に)。
  // 取得(server)を含むので一覧は server で読む。上流の物は隣の <key>.override.ts で変える(allowRoles は絞るだけ)
  adminDashboardSections: {
    change: "add",
    plugs: true,
    export: "section",
    type: { from: "@/domains/core/admin/dashboard/types", name: "AdminDashboardSectionDefinition" },
    side: "server",
    key: "key",
    overrideOf: ["hidden", "allowRoles", "order"],
  },
  // 管理の一覧の一括操作: 差す側の <ドメイン>/plugs/adminBulkActions/<名前>.tsx の export const bulkAction(段 3 注文 24 Q2)。効く一覧 = 項目の domain
  // (省略 = 差したドメインの一覧。fork は上流のドメインの中に足さず、自分のドメインに置いて domain で上流の一覧を名指す)。
  // key は一覧ごとに一意(全体では見ない)。読み手は hooks/useDomainAdminBulkActions(ドメインで絞り、門番で閉じた項目を外す)。作り方: src/lib/tableSuite/README.md「一括操作の受け口」
  adminBulkActions: {
    change: "add",
    plugs: true,
    export: "bulkAction",
    type: { from: "@/domains/core/admin/types/adminBulkAction", name: "AdminBulkActionItem" },
    side: "client",
    overrideOf: ["enabled", "order"],
  },
};

// 常設(どの機能の規則にも載らず常に開く、明示の宣言 D22・D53)。規則の domains に載せると地区の地図の生成で止まる
export const alwaysOpen = true;
