# promptFragments(DB 調査エージェントのプロンプト断片の受け口)

## Overview

DB 調査エージェントのプロンプトに足す断片を置く受け口。`<名前>.ts` に `export const fragment: DbAgentPromptFragment` を置き、`pnpm generate extensions`。上流の項目は 0。

## Related

- 書き方: `src/lib/dbAgent/README.md`
- 受け口の仕組み: `scripts/structure/extensions/README.md`
