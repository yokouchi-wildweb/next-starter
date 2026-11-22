// src/domains/core/admin/extensionPoints.ts
// admin の拡張点の宣言(リテラルだけ。pnpm generate extensions が読み ./extensions/<点>.ts を生成する)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // 管理メニューのカテゴリー: menu/categories/<key>.ts の export const category。fork は自分のカテゴリーを足し、上流の物は隣の <key>.override.ts で変える
  menuCategories: {
    dir: "menu/categories",
    export: "category",
    type: { from: "@/domains/core/admin/menu/types", name: "AdminMenuCategoryDefinition" },
    side: "client",
    key: "key",
    overrideOf: ["hidden", "label", "icon", "allowRoles", "order"],
  },
  // 管理メニューの項目: menu/items/<key>.ts の export const item(link / domain / source の 3 形)。上流の物は隣の <key>.override.ts で変える
  menuItems: {
    dir: "menu/items",
    export: "item",
    type: { from: "@/domains/core/admin/menu/types", name: "AdminMenuItemDefinition" },
    side: "client",
    key: "key",
    overrideOf: ["hidden", "label", "icon", "allowRoles", "order", "category"],
  },
  // 管理ダッシュボードのセクション: dashboard/sections/<key>.ts(x) の export const section(描画 Section と取得 load を 1 つの定義に)。
  // 取得(server)を含むので一覧は server で読む。上流の物は隣の <key>.override.ts で変える(allowRoles は絞るだけ)
  dashboardSections: {
    dir: "dashboard/sections",
    export: "section",
    type: { from: "@/domains/core/admin/dashboard/types", name: "AdminDashboardSectionDefinition" },
    side: "server",
    key: "key",
    overrideOf: ["hidden", "allowRoles", "order"],
  },
};
