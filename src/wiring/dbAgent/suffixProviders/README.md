# suffixProviders(DB 調査エージェントの実行時サフィックスのプロバイダの受け口)

## Overview

- DB 調査エージェントの実行時サフィックスのプロバイダを足す受け口。上流の項目は 0

## Extension

- `<名前>.ts` に `export const provider: DbAgentSystemSuffixProvider` を置き、`pnpm generate extensions`

## Related

- 書き方: `src/lib/dbAgent/README.md`
- 受け口の仕組み: `scripts/structure/extensions/README.md`
