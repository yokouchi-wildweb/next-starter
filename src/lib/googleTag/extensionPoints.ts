// src/lib/googleTag/extensionPoints.ts
// Google tag(lib)の拡張点の宣言(リテラルだけ。読み手 = src/lib/districtMap/declarations.mjs)。書式: scripts/structure/extensions/README.md
// 一覧と結び目は生成物 src/wiring/googleTag.ts(pnpm generate extensions、D31)。lib は一覧を読まない

export const extensionPoints = {
  // 流入経路の判別表: 差す側の <ドメイン>/plugs/googleTagChannels/<名前>.ts の export const channels({ definitions: () => 表の行 })。
  // 上流は userAcquisition が差す(閉じている間は門番が外し、表は空 = GA4 へ経路を送らない)
  googleTagChannels: {
    change: "add",
    plugs: true,
    export: "channels",
    type: { from: "@/lib/googleTag/points", name: "GoogleTagChannelSource" },
    side: "server",
    target: "wiring",
  },
};

// 結び目: src/wiring/googleTag.ts の GoogleTag = wireGoogleTag({ googleTagChannels: 門番で絞った一覧 })
export const wire = { name: "wireGoogleTag", export: "GoogleTag", side: "server" };
