// src/app/_layout/extensionPoints.ts
// 根の枠の拡張点の宣言(リテラルだけ。読み手 = src/lib/districtMap/declarations.mjs)。書式: scripts/structure/extensions/README.md
// 枠はドメインを値も型も読まない(D22・D25)。部品は持ち主のドメインの plugs/<点>/<名前>.ts(x) に置いて差し、閉じたドメインの部品は門番が外す。約束の型: ./types.ts

export const extensionPoints = {
  // 置き場: ブランドの favicon(Next のファイルの決まり。上流は見本を出荷)
  appIcon: { change: "counterpart", placement: "src/app/favicon.ico", kind: "edit" },
  // 枠のログインの状態とログアウト: 差す側の <ドメイン>/plugs/frameSession/<名前>.ts の export const plug({ useSession, useLogout })。
  // ちょうど 1 つ(required、D53): 上流は常設の auth が 1 行スイッチの既定を差し、fork は auth の差替点 authFrameSession で <名前>.replace.ts に替える
  frameSession: {
    change: "add",
    plugs: true,
    export: "plug",
    type: { from: "@/app/_layout/points", name: "FrameSessionPlug" },
    side: "client",
    shape: "object",
    max: 1,
    required: true,
  },
  // アプリ全体を包む Provider: 差す側の <ドメイン>/plugs/rootProviders/<名前>.tsx の export const provider と export const stage = "<段>"。
  // 入れ子は段の並び(外 → 内、D30 と同じ形): outer(骨組み: Tooltip・reCAPTCHA)→ session(ログインの状態)→ domain(ドメインの Provider)→
  // inner(骨組み: 画像ビューア・入力部品・未保存の編集の守り)→ project(fork の Provider。前の ForkProviders、注文 32 AMENDMENT 1)。
  // 骨組みと入れ子は src/wiring/AppProviders.tsx
  rootProviders: {
    change: "add",
    plugs: true,
    export: "provider",
    type: { from: "@/app/_layout/points", name: "RootProvider" },
    side: "shared",
    stages: ["outer", "session", "domain", "inner", "project"],
    skeletonStages: ["outer", "inner"],
  },
} as const;
