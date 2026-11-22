// src/domains/core/rateLimit/extensionPoints.ts
// src/domains/core/rateLimit の拡張点の宣言(リテラルだけ。読み手 = src/lib/districtMap/declarations.mjs)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // 差替点: API ルートの Factory のレート制限(点 routeFactoryRateLimit の上流の項目、1 行スイッチ plugs/routeFactoryRateLimit/ipRate.ts。
  // ちょうど 1 つの点なので fork は 2 つ目を足さず、隣に ipRate.replace.ts を作りスイッチを向け替える、D53)
  rateLimitRouteFactoryRateLimit: {
    change: "replace",
    default: "src/domains/core/rateLimit/plugs/routeFactoryRateLimit/ipRate.default.ts",
    type: { from: "@/lib/routeFactory/points", name: "RouteRateLimitPlug" },
    side: "server",
  },
};

// 常設(どの機能の規則にも載らず常に開く、明示の宣言 D22・D53)。規則の domains に載せると地区の地図の生成で止まる
export const alwaysOpen = true;
