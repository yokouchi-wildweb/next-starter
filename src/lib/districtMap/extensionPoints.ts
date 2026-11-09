// src/lib/districtMap/extensionPoints.ts
// 地区の地図の拡張点の宣言(リテラルだけ。読み手 = ./declarations.mjs)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // 置き場: 地区の config.ts の上書き src/config/{lib,features,layout,proxies}/<名前>.config.ts(対の検査 pnpm check config-overrides)。
  // config の再設計までは src/config の下全体(移行中の app/・ui/・直下のファイルも)を fork の値として書き換えてよい(./kinds.mjs の OVERRIDE_ROOT)
  configValues: { placement: "src/config/**", kind: "edit" },
} as const;
