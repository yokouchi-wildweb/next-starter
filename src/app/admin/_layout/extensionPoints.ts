// src/app/admin/_layout/extensionPoints.ts
// src/app/admin/_layout の拡張点の宣言(リテラルだけ。読み手 = src/lib/districtMap/declarations.mjs)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // 差替点: 1 行スイッチ AdminHeader(fork は隣に <名前>.replace を作りスイッチを向け替える)
  adminHeader: {
    change: "replace",
    default: "src/app/admin/_layout/AdminHeader.default.tsx",
    type: { from: "@/app/admin/_layout/AdminHeader.default", name: "AdminHeaderProps" },
    side: "client",
  },
};
