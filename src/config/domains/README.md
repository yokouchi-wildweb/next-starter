# src/config/domains — ドメインの上書き

## Overview

- ドメイン(`src/domains/<名前>`・`src/domains/core/<名前>`)1 つに上書き 1 本: `<名前>.config.ts`。名前はドメインのフォルダ名(core も業務も同じ平らなフォルダ)

## Extension

- 持ち主のドメインが描画用の `config.ui.ts` を持つときだけ `<名前>.ui.config.ts` を並べます
- 持ち主の既定と型は `<ドメイン>/config.ts`。上書きはそこだけが読む
- ドメインの中の処理の入切(例 demo の `mode.enabled`)もここに書く。門番の機能(`src/featureGate/rules/`)の入切は `../featureGate/switches.config.ts`

## Related

- 置き方・中身の決まり・1 対 1 の検査: [../README.md](../README.md)
