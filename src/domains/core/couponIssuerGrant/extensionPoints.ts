// src/domains/core/couponIssuerGrant/extensionPoints.ts
// src/domains/core/couponIssuerGrant の拡張点の宣言(リテラルだけ。読み手 = src/lib/districtMap/declarations.mjs)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // 差替点: 1 行スイッチ programConfig(fork は隣に <名前>.replace を作りスイッチを向け替える)
  programConfig: {
    change: "replace",
    default: "src/domains/core/couponIssuerGrant/services/server/programConfig.default.ts",
    type: { from: "@/domains/core/couponIssuerGrant/types/program", name: "CouponIssuerProgramConfig" },
    side: "server",
  },
};
