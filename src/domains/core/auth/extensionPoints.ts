// src/domains/core/auth/extensionPoints.ts
// src/domains/core/auth の拡張点の宣言(リテラルだけ。読み手 = src/lib/districtMap/declarations.mjs)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // 差替点: 1 行スイッチ RateLimitWarningContent(fork は隣に <名前>.replace を作りスイッチを向け替える)
  rateLimitWarningContent: {
    change: "replace",
    default: "src/domains/core/auth/components/Registration/RateLimitWarningContent.default.tsx",
    type: { from: "@/domains/core/auth/components/Registration/RateLimitWarningContent.default", name: "RateLimitWarningContentProps" },
    side: "client",
  },
};
