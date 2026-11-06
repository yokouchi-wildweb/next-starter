// src/features/core/adminCommand/extensionPoints.ts
// adminCommand の拡張点の宣言(リテラルだけ。pnpm generate extensions が読み ./extensions/<点>.ts を生成する)。書式: scripts/structure/extensions/README.md
// カテゴリ・プラグイン(React)の点は src/app/_layout/adminCommand/extensionPoints.ts

export const extensionPoints = {
  // ナビゲーション先: navigationItems/<名前>.ts の export const items(配列。一覧の順に連結)
  navigationItems: {
    dir: "navigationItems",
    export: "items",
    type: { from: "@/features/core/adminCommand/types", name: "NavigationItemGroup" },
    side: "client",
  },
};
