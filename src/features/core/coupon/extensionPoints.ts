// src/features/core/coupon/extensionPoints.ts
// coupon の拡張点の宣言(リテラルだけ。pnpm extensions:generate が読み ./extensions/<点>.ts を生成する)。書式: scripts/extensions/README.md

export const extensionPoints = {
  // クーポン管理画面のセクションタブ: adminSectionTabs/<名前>[.<fork の名前>].ts の export const tab(上流の項目は 0)
  sectionTabs: {
    dir: "adminSectionTabs",
    export: "tab",
    type: { from: "@/components/Navigation", name: "PageTabItem" },
    side: "client",
  },
};
