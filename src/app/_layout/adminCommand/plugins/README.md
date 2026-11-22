# plugins(管理者コマンドのプラグインの受け口)

## Overview

管理者コマンドのプラグインを置く受け口。`<名前>.tsx` に `export const plugin: AdminCommandPlugin` を置き、`pnpm generate extensions`。上流の項目は 0。

## Related

- 書き方: `src/domains/core/adminCommand/README.md`「プラグイン（Provider・GlobalComponent）」
- 受け口の仕組み: `scripts/structure/extensions/README.md`
