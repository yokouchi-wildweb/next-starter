// src/app/_layout/extensionPoints.ts
// 根の枠の拡張点の宣言(リテラルだけ。読み手 = src/lib/districtMap/declarations.mjs)。書式: scripts/structure/extensions/README.md

export const extensionPoints = {
  // 置き場: ブランドの favicon(Next のファイルの決まり。上流は見本を出荷)
  appIcon: { change: "counterpart", placement: "src/app/favicon.ico", kind: "edit" },
  // 差替点: 1 行スイッチ ForkProviders(fork は隣に <名前>.replace を作りスイッチを向け替える)
  forkProviders: {
    change: "replace",
    default: "src/app/_providers/ForkProviders.default.tsx",
    type: { from: "@/app/_providers/ForkProviders.default", name: "ForkProvidersProps" },
    side: "shared",
  },
} as const;
