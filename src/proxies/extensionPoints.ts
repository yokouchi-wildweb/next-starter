// src/proxies/extensionPoints.ts
// proxy の拡張点の宣言(リテラルだけ。pnpm generate extensions が字面で読み、src/proxies/extensions/<点>.ts を生成する)。
// 書式: scripts/structure/extensions/README.md / proxy の枠と規則: ./README.md
// 項目はどれも差す側の <ドメイン>/plugs/<点>/<名前>.ts(D22・D30・D38)。src/proxy.ts と src/proxies はドメインを値も型も読まず、生成された一覧を門番で絞って使う

export const extensionPoints = {
  // 利用者の解き方: 差す側の <ドメイン>/plugs/proxyUser/<名前>.ts の export const plug({ createUser(cookies) })。
  // ちょうど 1 つ(required、D53): 上流は常設の auth が 1 行スイッチの既定を差し、fork は auth の差替点 authProxyUser で <名前>.replace.ts に替える
  proxyUser: {
    change: "add",
    plugs: true,
    export: "plug",
    type: { from: "@/proxies/points", name: "AnyProxyUserPlug" },
    side: "server",
    shape: "object",
    max: 1,
    required: true,
  },
  // handler: 差す側の <ドメイン>/plugs/proxyHandlers/<名前>.ts の export const handler と export const stage = "<段>"。
  // 鎖は段の並びで走る(同じ段の中は <差す側>/<名前> の順、D30): maintenance(止める)→ mode(動作の型: デモなど)→ gate(骨組み: 門番の 404)→
  // redirect(骨組み: 転送)→ main(そのほか)。gate と redirect は骨組み(./index.ts)だけが使う
  proxyHandlers: {
    change: "add",
    plugs: true,
    export: "handler",
    type: { from: "@/proxies/points", name: "ProxyHandler" },
    side: "server",
    stages: ["maintenance", "mode", "gate", "redirect", "main"],
    skeletonStages: ["gate", "redirect"],
  },
  // decorator: 差す側の <ドメイン>/plugs/proxyDecorators/<名前>.ts の export const decorator。素通しの応答に <差す側>/<名前> の順で副作用を加える(互いに依存しない)
  proxyDecorators: {
    change: "add",
    plugs: true,
    export: "decorator",
    type: { from: "@/proxies/points", name: "ProxyResponseDecorator" },
    side: "server",
  },
  // 転送の規則: 差す側の <ドメイン>/plugs/proxyRedirects/<名前>.ts の export const redirects(1 ファイル = 規則の 1 組)。
  // 同じ sourcePath が 2 つの規則にあると ./redirect.ts の読み込みで止まる
  proxyRedirects: {
    change: "add",
    plugs: true,
    export: "redirects",
    type: { from: "@/proxies/points", name: "RedirectRuleGroup" },
    side: "server",
  },
};
