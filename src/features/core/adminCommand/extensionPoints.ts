// src/features/core/adminCommand/extensionPoints.ts
// adminCommand の拡張点の宣言(リテラルだけ。pnpm extensions:generate が読み ./extensions/<点>.ts を生成する)。書式: scripts/extensions/README.md
// カテゴリ・プラグイン(React)の点は src/app/_layout/adminCommand/extensionPoints.ts

export const extensionPoints = {
  // ナビゲーション先: navigationItems/<名前>[.<fork の名前>].ts の export const items(配列。一覧の順に連結)
  navigationItems: {
    dir: "navigationItems",
    export: "items",
    type: { from: "@/features/core/adminCommand/types", name: "NavigationItemGroup" },
    side: "client",
  },
};
