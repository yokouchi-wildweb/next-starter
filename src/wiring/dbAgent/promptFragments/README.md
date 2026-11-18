# promptFragments(DB 調査エージェントのプロンプト断片の受け口)

## Overview

- DB 調査エージェントのプロンプトに足す断片の受け口。上流の項目は 0

## Extension

- `<名前>.ts` に `export const fragment: DbAgentPromptFragment` を置き、`pnpm generate extensions`

## Related

- 書き方: `src/lib/dbAgent/README.md`
- 受け口の仕組み: `scripts/structure/extensions/README.md`
