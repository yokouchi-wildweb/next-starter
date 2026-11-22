// src/domains/core/coupon/extensionPoints.ts
// coupon の拡張点の宣言(リテラルだけ。pnpm generate extensions が読み ./extensions/<点>.ts を生成する)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // クーポン管理画面のセクションタブ: <ドメイン>/plugs/couponSectionTabs/<名前>.ts の export const tab(上流の項目は 0)
  couponSectionTabs: {
    change: "add",
    plugs: true,
    export: "tab",
    type: { from: "@/domains/core/coupon/types/sectionTab", name: "CouponSectionTabItem" },
    side: "client",
  },
};
