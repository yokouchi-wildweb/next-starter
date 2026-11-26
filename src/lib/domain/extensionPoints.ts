// src/lib/domain/extensionPoints.ts
// 登録表(serviceRegistry)の拡張点の宣言(リテラルだけ。読み手 = src/lib/districtMap/declarations.mjs)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // 上書きの対象: 各登録の宣言 entities/<登録名>/entity.json。fork は隣の entity.override.ts(export const entityOverride = { apiAccess })で
  // 登録表(src/registry/serviceRegistry.ts)のその行の access を丸ごと差し替える(generate:false の登録の apiAccess と同じ意味。生成の既定は重ねない)
  entities: {
    change: "override",
    overrides: "src/domains/**/entities/*/entity.json",
    export: "entityOverride",
    side: "server",
    overrideOf: ["apiAccess"],
  },
} as const;
