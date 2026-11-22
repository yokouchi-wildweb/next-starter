// src/lib/serverErrorReport/extensionPoints.ts
// サーバーの失敗の記録(lib)の拡張点の宣言(リテラルだけ。読み手 = src/lib/districtMap/declarations.mjs)。書式: scripts/structure/extensions/README.md
// 一覧と結び目は生成物 src/wiring/serverErrorReport.ts(pnpm generate extensions、D31)。lib は一覧を読まない

export const extensionPoints = {
  // 送り先: 差す側の <ドメイン>/plugs/serverErrorReporters/<名前>.ts(lib は <lib>/plugs/…)の export const reporter。失敗のときだけ読む(lazy、edge の束に静的に入れない)。上流の項目は 0
  serverErrorReporters: {
    change: "add",
    plugs: true,
    export: "reporter",
    type: { from: "@/lib/serverErrorReport/points", name: "ServerErrorReporter" },
    side: "server",
    load: "lazy",
    target: "wiring",
  },
};

// 結び目: src/wiring/serverErrorReport.ts の serverErrorReport = wireServerErrorReport({ serverErrorReporters: 門番で絞った一覧 })
export const wire = { name: "wireServerErrorReport", export: "serverErrorReport", side: "server" };
