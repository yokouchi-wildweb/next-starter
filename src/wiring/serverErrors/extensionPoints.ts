// src/wiring/serverErrors/extensionPoints.ts
// サーバーの失敗の送り先の拡張点の宣言(リテラルだけ。pnpm generate extensions が読み ./extensions/<点>.ts を生成する)。書式: scripts/structure/extensions/README.md
// 宣言と受け口をここに置く理由: src/lib/serverErrorReport は一覧を知らない(./index.ts が渡す)。項目は失敗のときだけ読む(load: lazy、edge の束に静的に入れない)

export const extensionPoints = {
  // 送り先: reporters/<名前>.ts の export const reporter(上流の項目は 0。fork が自分の監視をつなぐ)
  reporters: {
    dir: "reporters",
    export: "reporter",
    type: { from: "@/lib/serverErrorReport", name: "ServerErrorReporter" },
    side: "server",
    load: "lazy",
  },
};
