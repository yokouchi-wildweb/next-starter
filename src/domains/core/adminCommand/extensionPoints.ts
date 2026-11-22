// src/domains/core/adminCommand/extensionPoints.ts
// adminCommand の拡張点の宣言(リテラルだけ。pnpm generate extensions が読み ./extensions/<点>.ts を生成する)。書式: scripts/structure/extensions/README.md
// 管理者のときだけ読み込む(load: lazy)。読み手は ./plugs/rootProviders/adminCommand.tsx(根の枠の点 rootProviders の項目)→ AdminCommandProvider

export const extensionPoints = {
  // ナビゲーション先: <ドメイン>/plugs/adminCommandNavigationItems/<名前>.ts の export const items(配列。一覧の順に連結)
  adminCommandNavigationItems: {
    change: "add",
    plugs: true,
    export: "items",
    type: { from: "@/domains/core/adminCommand/types", name: "NavigationItemGroup" },
    side: "client",
  },
  // パレットの第 1 メニューのカテゴリ: <ドメイン>/plugs/adminCommandCategories/<名前>.tsx の export const category(上流: navigation・settings・userSession)
  adminCommandCategories: {
    change: "add",
    plugs: true,
    export: "category",
    type: { from: "@/domains/core/adminCommand/base/types", name: "CategoryConfig" },
    side: "client",
    load: "lazy",
  },
  // カテゴリの Provider・GlobalComponent: <ドメイン>/plugs/adminCommandPlugins/<名前>.tsx の export const plugin(上流の項目は 0)
  adminCommandPlugins: {
    change: "add",
    plugs: true,
    export: "plugin",
    type: { from: "@/domains/core/adminCommand/base/types", name: "AdminCommandPlugin" },
    side: "client",
    load: "lazy",
  },
};

// 常設(どの機能の規則にも載らず常に開く、明示の宣言 D22・D53)。規則の domains に載せると地区の地図の生成で止まる
export const alwaysOpen = true;
