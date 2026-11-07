// src/features/core/admin/extensionPoints.ts
// admin の拡張点の宣言(リテラルだけ。pnpm extensions:generate が読み ./extensions/<点>.ts を生成する)。書式: scripts/extensions/README.md

export const extensionPoints = {
  // 管理メニューのカテゴリー: menu/categories/<key>.ts の export const category。fork は自分のカテゴリーを足し、上流の物は隣の <key>.override.ts で変える
  menuCategories: {
    dir: "menu/categories",
    export: "category",
    type: { from: "@/features/core/admin/menu/types", name: "AdminMenuCategoryDefinition" },
    side: "client",
    key: "key",
    overrideOf: ["hidden", "label", "icon", "allowRoles", "order"],
  },
  // 管理メニューの項目: menu/items/<key>.ts の export const item(link / domain / source の 3 形)。上流の物は隣の <key>.override.ts で変える
  menuItems: {
    dir: "menu/items",
    export: "item",
    type: { from: "@/features/core/admin/menu/types", name: "AdminMenuItemDefinition" },
    side: "client",
    key: "key",
    overrideOf: ["hidden", "label", "icon", "allowRoles", "order", "category"],
  },
};
