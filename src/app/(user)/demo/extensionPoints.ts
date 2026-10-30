// src/app/(user)/demo/extensionPoints.ts
// デモの一覧の拡張点の宣言(リテラルだけ。pnpm extensions:generate が読み ./extensions/<点>.ts を生成する)。書式: scripts/extensions/README.md

export const extensionPoints = {
  // デモの一覧: <route のフォルダ>/_demo.ts の export const demo
  demoPages: {
    dir: ".",
    files: "*/_demo.ts",
    export: "demo",
    type: { from: "@/app/(user)/demo/_data/demoPages", name: "DemoPage" },
    side: "shared",
  },
};
