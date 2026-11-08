# src/registry

業務ドメインを全体で扱うための一覧の置き場。**下流が中身を足す登録口ではない**。ドメインを 1 つ作ると 1 行増える一覧で、ここのファイルは編集しない。

| ファイル | 作られ方 |
|---|---|
| `serviceRegistry.ts`・`schemaRegistry.ts`・`domainConfigRegistry.ts`・`storagePurposeRegistry.ts`・`adminDomains.ts` | `pnpm generate registry` が丸ごと生成(`scripts/structure/registry/README.md`)。build の冒頭の `pnpm check registry` が一致を見る |
| `district-map.jsonl` | `pnpm generate district-map` が地区の地図の読み手 `src/lib/districtMap` から生成(1 行 1 地区)。人・agent・/ship と /flux の差分用で、src から import しない(lint `import-boundaries/src-no-district-map`)・他の生成の入力にしない。build の冒頭の `pnpm check district-map` が鮮度を見る |

## 足したいとき

- 機能ごとの差し込み(ハンドラ・用途・タブなど): 持ち主のドメインの受け口にファイルを置いて `pnpm generate extensions`(`scripts/structure/extensions/README.md`)
- 値: `src/config/`
- 管理画面「データ管理」のメニューからドメインを外す: `domain.json` の `addToAdminDataMenu: false`(`adminDomains.ts` の印。メニューの出どころ `dataMenu` が読む)
- 管理メニューの行・カテゴリー: 受け口 `src/features/core/admin/menu/`(`README.md`)
