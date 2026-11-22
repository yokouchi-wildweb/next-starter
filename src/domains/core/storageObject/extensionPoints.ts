// src/domains/core/storageObject/extensionPoints.ts
// storageObject の拡張点の宣言(リテラルだけ。pnpm generate extensions が読み ./extensions/<点>.ts を生成する)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // ファイル用途: <ドメイン>/plugs/storageObjectPurposes/<名前>.ts の export const purposes(用途 ID → 規則。ID の重複は例外)
  storageObjectPurposes: {
    change: "add",
    plugs: true,
    export: "purposes",
    type: { from: "@/lib/storage", name: "StoragePurposeMap" },
    side: "server",
  },
};

// 常設(どの機能の規則にも載らず常に開く、明示の宣言 D22・D53)。規則の domains に載せると地区の地図の生成で止まる
export const alwaysOpen = true;
