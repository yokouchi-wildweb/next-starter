// src/lib/backends/extensionPoints.ts
// バックエンドの部品(lib)の拡張点の宣言(リテラルだけ。読み手 = src/lib/districtMap/declarations.mjs)。書式: scripts/structure/extensions/README.md
// 一覧は生成物 src/wiring/backends.ts(pnpm generate extensions)。lib は一覧を読まない

export const extensionPoints = {
  // 能力の語(D19): 差す側の <ドメイン>/plugs/backendCapabilities/<名前>.ts(lib は <lib>/plugs/…)の export const capabilities = { port, words }(字面だけ)。
  // 上流の語は口の持ち主の項目、フォークの語は自分の lib の項目。生成器と検査が構文木で読む。上流の項目は 0
  backendCapabilities: {
    change: "add",
    plugs: true,
    export: "capabilities",
    type: { from: "@/lib/backends/points", name: "BackendCapabilityItem" },
    side: "server",
    pureImports: true,
    target: "wiring",
  },
};
