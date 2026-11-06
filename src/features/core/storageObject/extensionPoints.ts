// src/features/core/storageObject/extensionPoints.ts
// storageObject の拡張点の宣言(リテラルだけ。pnpm generate extensions が読み ./extensions/<点>.ts を生成する)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // ファイル用途: purposes/<名前>.ts の export const purposes(用途 ID → 規則。ID の重複は例外)
  purposes: {
    dir: "purposes",
    export: "purposes",
    type: { from: "@/lib/storage", name: "StoragePurposeMap" },
    side: "server",
  },
};
