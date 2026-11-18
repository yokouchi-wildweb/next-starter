# extraTools(DB 調査エージェントの追加ツールの受け口)

## Overview

- DB 調査エージェントに足すツールの受け口。上流の項目は 0

## Extension

- `<名前>.ts` に `export const tool: AgentToolDefinition` を置き、`pnpm generate extensions`

## Related

- 書き方: `src/lib/dbAgent/README.md`
- 仕組み: `scripts/structure/extensions/README.md`
