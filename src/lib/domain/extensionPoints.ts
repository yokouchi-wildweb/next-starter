// src/lib/domain/extensionPoints.ts
// 登録表(serviceRegistry)の拡張点の宣言(リテラルだけ。読み手 = src/lib/districtMap/declarations.mjs)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // 上書きの対象: 各ドメインの domainEntry.ts。fork は隣の domainEntry.override.ts(export const domainEntryOverrides = { <キー>: <値> })で
  // 次の鍵の値を丸ごと差し替える(1 つのファイルで差し替えられる属性は 1 つなので、鍵は 1 つだけ)
  domainEntries: {
    overrides: "src/features/**/services/server/domainEntry.ts",
    side: "server",
    overrideOf: ["access"],
  },
} as const;
