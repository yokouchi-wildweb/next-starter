// src/lib/folderCatalog/extensionPoints.ts
// lib の目録の拡張点の宣言(リテラルだけ。読み手 = src/lib/districtMap/declarations.mjs)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // 置き場: src/lib/CATALOG.md は各リポが自分の節を末尾に足すだけ(基準の中身を先頭に残したままの追記。書式 src/lib/README.md)
  catalogSections: { change: "counterpart", placement: "src/lib/CATALOG.md", kind: "append" },
  // 置き場: src/components/CATALOG.md(部品の棚の単位の目録)も同じく各リポが自分の節を末尾に足すだけ
  componentsCatalogSections: { change: "counterpart", placement: "src/components/CATALOG.md", kind: "append" },
  // 置き場: src/hooks/CATALOG.md・src/utils/CATALOG.md(1 ファイル = 1 単位の目録)も同じく自分の節を末尾に足すだけ
  hooksCatalogSections: { change: "counterpart", placement: "src/hooks/CATALOG.md", kind: "append" },
  utilsCatalogSections: { change: "counterpart", placement: "src/utils/CATALOG.md", kind: "append" },
} as const;
