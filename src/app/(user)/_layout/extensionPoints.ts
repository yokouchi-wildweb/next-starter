// src/app/(user)/_layout/extensionPoints.ts
// 利用者の枠の拡張点の宣言(リテラルだけ。読み手 = src/lib/districtMap/declarations.mjs)。書式: scripts/structure/extensions/README.md
// 枠はドメインを読まない(D25): 部品は持ち主のドメインの plugs/<点>/<名前>.tsx の export const part(型 FramePart、@/app/_layout/types)に置いて差す。
// 閉じたドメインの部品は名前ごと一覧から消える(useGate().plugs)。fork が枠を差し替えても同じ一覧から名前で部品を選んで並べられる

export const extensionPoints = {
  // ヘッダーの右側(fork が UserNavigation に actions を渡さないとき、上流の既定の CTA の前に並ぶ): <ドメイン>/plugs/userHeaderActions/<名前>.tsx。
  // 並びは項目の export const order(数)→ <差す側>/<名前>。上流の項目は 0(fork の通知のベル・設定の入口など)
  userHeaderActions: {
    change: "add",
    plugs: true,
    export: "part",
    type: { from: "@/app/(user)/_layout/points", name: "FramePart" },
    side: "client",
    order: "declared",
  },
  // 枠に重ねる部品(ダイアログ・案内): <ドメイン>/plugs/userOverlays/<名前>.tsx。上流は messaging の受け取り箱の未読の案内
  userOverlays: {
    change: "add",
    plugs: true,
    export: "part",
    type: { from: "@/app/(user)/_layout/points", name: "FramePart" },
    side: "client",
  },
};
