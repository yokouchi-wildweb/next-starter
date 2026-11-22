# definitions(マイルストーン定義の受け口)

## Overview

- `<名前>.ts` に `export const milestone: MilestoneItem`(普通の定義 `MilestoneDefinition` か段階のあるシリーズ)を置き、`pnpm generate extensions`。上流の項目は 0
- 書き方: `src/domains/core/milestone/README.md` Usage / 仕組み: `scripts/structure/extensions/README.md`
