// src/proxies/extensionPoints.ts
// proxy の拡張点の宣言(リテラルだけ。pnpm extensions:generate が字面で読み、src/proxies/extensions/<点>.ts を生成する)。
// 書式: scripts/extensions/README.md / proxy の枠と規則: ./README.md
// ignore = 骨組み(index.ts が手書きで並べる上流の handler 4・decorator 2)と枠そのもの。項目として走査しない

export const extensionPoints = {
  // 枠の handler: src/proxies/<名前>[.<fork の名前>].ts の export const handler。骨組みの後ろでファイル名の順に走る
  handlers: {
    dir: ".",
    export: "handler",
    type: { from: "@/proxies/types", name: "ProxyHandler" },
    side: "server",
    ignore: ["maintenance.ts", "demoMode.ts", "featureGate.ts", "redirect.ts", "attribution.ts", "inviteLink.ts", "index.ts", "types.ts"],
  },
  // 枠の decorator: 同じ置き場の export const decorator(1 ファイルに handler と decorator の両方は置かない)
  decorators: {
    dir: ".",
    export: "decorator",
    type: { from: "@/proxies/types", name: "ProxyResponseDecorator" },
    side: "server",
    ignore: ["maintenance.ts", "demoMode.ts", "featureGate.ts", "redirect.ts", "attribution.ts", "inviteLink.ts", "index.ts", "types.ts"],
  },
  // 機能を閉じる規則: featureGateRules/<名前>[.<fork の名前>].ts の export const rule。tables は features のフォルダから導く
  featureGateRules: {
    dir: "featureGateRules",
    export: "rule",
    type: { from: "@/proxies/types", name: "GatedFeatureRule" },
    side: "shared",
    derive: "featureTables",
  },
};
