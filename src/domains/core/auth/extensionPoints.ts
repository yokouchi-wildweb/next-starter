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
  // 差替点: API ルートの Factory の利用者の解き方(点 routeFactoryUser の上流の項目、1 行スイッチ plugs/routeFactoryUser/session.ts。
  // ちょうど 1 つの点なので fork は 2 つ目を足さず、隣に session.replace.ts を作りスイッチを向け替える、D53)
  authRouteFactoryUser: {
    change: "replace",
    default: "src/domains/core/auth/plugs/routeFactoryUser/session.default.ts",
    type: { from: "@/lib/routeFactory/points", name: "RouteUserPlug" },
    side: "server",
  },
  // 差替点: proxy の利用者の解き方(点 proxyUser の上流の項目、1 行スイッチ plugs/proxyUser/session.ts。
  // ちょうど 1 つの点なので fork は 2 つ目を足さず、隣に session.replace.ts を作りスイッチを向け替える、D53)
  authProxyUser: {
    change: "replace",
    default: "src/domains/core/auth/plugs/proxyUser/session.default.ts",
    type: { from: "@/proxies/points", name: "ProxyUserPlug" },
    side: "server",
  },
  // 差替点: ページの守りの利用者の束(点 pageGuardUser の上流の項目、1 行スイッチ plugs/pageGuardUser/session.ts。
  // ちょうど 1 つの点なので fork は 2 つ目を足さず、隣に session.replace.ts を作りスイッチを向け替える、D53)
  authPageGuardUser: {
    change: "replace",
    default: "src/domains/core/auth/plugs/pageGuardUser/session.default.ts",
    type: { from: "@/lib/pageGuard/points", name: "PageGuardUserPlug" },
    side: "server",
  },
  // 差替点: 枠のログインの状態とログアウト(点 frameSession の上流の項目、1 行スイッチ plugs/frameSession/session.ts。
  // ちょうど 1 つの点なので fork は 2 つ目を足さず、隣に session.replace.tsx を作りスイッチを向け替える、D53)
  authFrameSession: {
    change: "replace",
    default: "src/domains/core/auth/plugs/frameSession/session.default.tsx",
    type: { from: "@/app/_layout/points", name: "FrameSessionPlug" },
    side: "client",
  },
};

// 常設(どの機能の規則にも載らず常に開く、明示の宣言 D22・D53)。規則の domains に載せると地区の地図の生成で止まる
export const alwaysOpen = true;
