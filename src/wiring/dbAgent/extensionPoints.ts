// src/wiring/dbAgent/extensionPoints.ts
// DB 調査エージェント(lib)の拡張点の宣言(リテラルだけ。pnpm extensions:generate が読み src/wiring/dbAgent.ts を生成する)。
// 宣言と受け口をここに置く理由: fork は祖先の lib の中にファイルを足せない(ownership:check の ancestor-lib-add)。書式: scripts/extensions/README.md

export const extensionPoints = {
  // 追加ツール: extraTools/<名前>[.<fork の名前>].ts の export const tool(読み取り専用の境界を壊さないこと、lib/dbAgent/README.md)
  extraTools: {
    dir: "extraTools",
    export: "tool",
    type: { from: "@/lib/ai", name: "AgentToolDefinition" },
    side: "server",
    target: "wiring",
  },
  // ドメイン知識のプロンプト断片: promptFragments/<名前>[.<fork の名前>].ts の export const fragment(文字列)
  promptFragments: {
    dir: "promptFragments",
    export: "fragment",
    type: { from: "@/lib/dbAgent/prompt", name: "DbAgentPromptFragment" },
    side: "server",
    target: "wiring",
  },
  // 実行時サフィックス(運営追加指示)のプロバイダ: suffixProviders/<名前>[.<fork の名前>].ts の export const provider
  suffixProviders: {
    dir: "suffixProviders",
    export: "provider",
    type: { from: "@/lib/dbAgent/prompt", name: "DbAgentSystemSuffixProvider" },
    side: "server",
    target: "wiring",
  },
};
