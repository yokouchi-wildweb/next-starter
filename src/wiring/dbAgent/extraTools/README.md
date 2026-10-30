# extraTools(DB 調査エージェントの追加ツールの受け口)

`<名前>.<fork の名前>.ts` に `export const tool: AgentToolDefinition` を置き、`pnpm extensions:generate`。上流の項目は 0。
書き方: `src/lib/dbAgent/README.md` / 仕組み: `scripts/extensions/README.md`
