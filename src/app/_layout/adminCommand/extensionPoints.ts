// src/app/_layout/adminCommand/extensionPoints.ts
// 管理者コマンドの拡張点の宣言(リテラルだけ。pnpm extensions:generate が読み ./extensions/<点>.ts を生成する)。書式: scripts/extensions/README.md
// 管理者のときだけ読み込む(load: lazy)。読み手は ./AdminCommandRoot.tsx → AdminCommandProvider

export const extensionPoints = {
  // パレットの第 1 メニューのカテゴリ: categories/<名前>[.<fork の名前>].tsx の export const category
  categories: {
    dir: "categories",
    export: "category",
    type: { from: "@/features/core/adminCommand/base/types", name: "CategoryConfig" },
    side: "client",
    load: "lazy",
  },
  // カテゴリの Provider・GlobalComponent: plugins/<名前>[.<fork の名前>].tsx の export const plugin(上流の項目は 0)
  plugins: {
    dir: "plugins",
    export: "plugin",
    type: { from: "@/features/core/adminCommand/base/types", name: "AdminCommandPlugin" },
    side: "client",
    load: "lazy",
  },
};
