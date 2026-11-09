// src/lib/business/extensionPoints.ts
// 事業の素性の拡張点の宣言(リテラルだけ。読み手 = src/lib/districtMap/declarations.mjs)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // 置き場: src/business の下 = 事業の素性(フォルダごと fork の物。上流は source: "sample" の見本を出荷、設定の議会 D88)
  businessValues: { placement: "src/business/**", kind: "edit" },
} as const;
