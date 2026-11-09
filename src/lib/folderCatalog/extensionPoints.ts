// src/lib/folderCatalog/extensionPoints.ts
// lib の目録の拡張点の宣言(リテラルだけ。読み手 = src/lib/districtMap/declarations.mjs)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // 置き場: src/lib/CATALOG.md は各リポが自分の節を末尾に足すだけ(基準の中身を先頭に残したままの追記。書式 src/lib/README.md)
  catalogSections: { placement: "src/lib/CATALOG.md", kind: "append" },
} as const;
