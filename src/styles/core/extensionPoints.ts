// src/styles/core/extensionPoints.ts
// スタイルの拡張点の宣言(リテラルだけ。読み手 = src/lib/districtMap/declarations.mjs)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // 置き場: src/styles 直下の CSS = そのリポの実効(入口 global.css、core/<名前>.css と対の palette / typography / gradient.css、overrides.css)。
  // core/ の下は上流の物(src/styles/README.md)
  rootStyles: { placement: "src/styles/*.css", kind: "edit" },
} as const;
