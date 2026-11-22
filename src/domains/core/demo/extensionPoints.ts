// src/domains/core/demo/extensionPoints.ts
// src/domains/core/demo の拡張点の宣言(リテラルだけ。読み手 = src/lib/districtMap/declarations.mjs)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // 差替点: 1 行スイッチ onDemoUserCreated(fork は隣に <名前>.replace を作りスイッチを向け替える)
  onDemoUserCreated: {
    change: "replace",
    default: "src/domains/core/demo/services/server/onDemoUserCreated.default.ts",
    type: { from: "@/domains/core/demo/services/server/onDemoUserCreated.default", name: "OnDemoUserCreated" },
    side: "server",
  },
};

// 常設(どの機能の規則にも載らず常に開く、明示の宣言 D22・D53)。規則の domains に載せると地区の地図の生成で止まる
export const alwaysOpen = true;
