// src/lib/pageGuard/extensionPoints.ts
// ページの守り(lib)の拡張点の宣言(リテラルだけ。読み手 = src/lib/districtMap/declarations.mjs)。書式: scripts/structure/extensions/README.md
// 一覧と結び目は生成物 src/wiring/pageGuard.ts(pnpm generate extensions、D31)。lib は一覧を読まない。約束の型: ./plugs.ts

export const extensionPoints = {
  // 利用者の束: 差す側の <ドメイン>/plugs/pageGuardUser/<名前>.ts の export const plug({ deps: PageGuardDeps })。
  // ちょうど 1 つ(required、D53): 上流は常設の auth が 1 行スイッチの既定を差し、fork は auth の差替点 authPageGuardUser で <名前>.replace.ts に替える
  pageGuardUser: {
    change: "add",
    plugs: true,
    export: "plug",
    type: { from: "@/lib/pageGuard/points", name: "AnyPageGuardUserPlug" },
    side: "server",
    shape: "object",
    max: 1,
    required: true,
    target: "wiring",
  },
};

// 結び目: src/wiring/pageGuard.ts の defineRootGuard = wirePageGuard<PageGuardUserMap>({ pageGuardUser: 門番で絞った一覧 })
export const wire = { name: "wirePageGuard", export: "defineRootGuard", side: "server" };
