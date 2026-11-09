// src/proxies/extensionPoints.ts
// proxy の拡張点の宣言(リテラルだけ。pnpm generate extensions が字面で読み、src/proxies/extensions/<点>.ts を生成する)。
// 書式: scripts/structure/extensions/README.md / proxy の枠と規則: ./README.md
// ignore = 骨組み(index.ts が手書きで並べる上流の handler 4・decorator 2)と枠そのもの、テーマのフォルダ(demo、設定 D93。受け口 redirects のフォルダは別の点なので自然に外れる)。項目として走査しない

export const extensionPoints = {
  // 枠の handler: src/proxies/<名前>.ts の export const handler。骨組みの後ろでファイル名の順に走る
  handlers: {
    dir: ".",
    export: "handler",
    type: { from: "@/proxies/types", name: "ProxyHandler" },
    side: "server",
    ignore: ["maintenance.ts", "demoMode.ts", "featureGate.ts", "redirect.ts", "attribution.ts", "inviteLink.ts", "index.ts", "types.ts", "demo"],
  },
  // 枠の decorator: 同じ置き場の export const decorator(1 ファイルに handler と decorator の両方は置かない)
  decorators: {
    dir: ".",
    export: "decorator",
    type: { from: "@/proxies/types", name: "ProxyResponseDecorator" },
    side: "server",
    ignore: ["maintenance.ts", "demoMode.ts", "featureGate.ts", "redirect.ts", "attribution.ts", "inviteLink.ts", "index.ts", "types.ts", "demo"],
  },
  // 転送の規則: src/proxies/redirects/<名前>.ts の export const redirects(1 ファイル = 規則の 1 組、上流の項目は 0)。
  // fork が独立した行を足す一覧なので受け口(鍵で合わせる表なら config)。同じ sourcePath が 2 つの規則にあると redirect.ts の読み込みで止まる
  redirects: {
    dir: "redirects",
    export: "redirects",
    type: { from: "@/proxies/types", name: "RedirectRuleGroup" },
    side: "server",
  },
};
