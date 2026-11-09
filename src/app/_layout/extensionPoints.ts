// src/app/_layout/extensionPoints.ts
// 根の枠の拡張点の宣言(リテラルだけ。読み手 = src/lib/districtMap/declarations.mjs)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // 置き場: ブランドの favicon(Next のファイルの決まり。上流は見本を出荷)
  appIcon: { placement: "src/app/favicon.ico", kind: "edit" },
} as const;
