// src/lib/dbAgent/extensionPoints.ts
// DB 調査エージェント(lib)の拡張点の宣言(リテラルだけ。読み手 = src/lib/districtMap/declarations.mjs)。書式: scripts/structure/extensions/README.md
// 一覧は生成物 src/wiring/dbAgent.ts(pnpm generate extensions、D31)。結び目は持たない: 一覧を読むのは route(src/app/api/admin/db-agent/route.ts)が門番で絞って lib に渡す

export const extensionPoints = {
  // 追加ツール: 差す側の <ドメイン>/plugs/dbAgentTools/<名前>.ts(lib は <lib>/plugs/…)の export const tool(読み取り専用の境界を壊さないこと、README.md)
  dbAgentTools: {
    change: "add",
    plugs: true,
    export: "tool",
    type: { from: "@/lib/dbAgent/points", name: "AgentToolDefinition" },
    side: "server",
    target: "wiring",
  },
  // ドメイン知識のプロンプト断片: <差す側>/plugs/dbAgentPromptFragments/<名前>.ts の export const fragment(文字列)
  dbAgentPromptFragments: {
    change: "add",
    plugs: true,
    export: "fragment",
    type: { from: "@/lib/dbAgent/points", name: "DbAgentPromptFragment" },
    side: "server",
    target: "wiring",
  },
  // 実行時サフィックス(運営追加指示)のプロバイダ: <差す側>/plugs/dbAgentSuffixProviders/<名前>.ts の export const provider
  dbAgentSuffixProviders: {
    change: "add",
    plugs: true,
    export: "provider",
    type: { from: "@/lib/dbAgent/points", name: "DbAgentSystemSuffixProvider" },
    side: "server",
    target: "wiring",
  },
};
