// src/app/admin/_layout/extensionPoints.ts
// src/app/admin/_layout の拡張点の宣言(リテラルだけ。読み手 = src/lib/districtMap/declarations.mjs)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // 差替点: 1 行スイッチ AdminHeader(fork は隣に <名前>.replace を作りスイッチを向け替える)
  adminHeader: {
    change: "replace",
    default: "src/app/admin/_layout/AdminHeader.default.tsx",
    type: { from: "@/app/admin/_layout/points", name: "AdminHeaderProps" },
    side: "client",
  },
  // 枠に重ねる部品(ランチャー・ダイアログ): <ドメイン>/plugs/adminOverlays/<名前>.tsx の export const part(型 FramePart、@/app/_layout/types)。
  // 枠はドメインを読まない(D25)、閉じたドメインの部品は門番が外す。上流の項目は 0
  adminOverlays: {
    change: "add",
    plugs: true,
    export: "part",
    type: { from: "@/app/admin/_layout/points", name: "FramePart" },
    side: "client",
  },
};
