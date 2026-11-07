# src/registry

業務ドメインを全体で扱うための一覧の置き場。**下流が中身を足す登録口ではない**。ドメインを 1 つ作ると 1 行増える一覧で、ここのファイルは編集しない。

| ファイル | 作られ方 |
|---|---|
| `serviceRegistry.ts`・`schemaRegistry.ts`・`domainConfigRegistry.ts`・`adminDataMenu.ts`・`storagePurposeRegistry.ts` | `pnpm generate registry` が丸ごと生成(`scripts/structure/registry/README.md`)。build の冒頭の `pnpm check registry` が一致を見る |

## 足したいとき

- 機能ごとの差し込み(ハンドラ・用途・タブなど): 持ち主のドメインの受け口にファイルを置いて `pnpm generate extensions`(`scripts/structure/extensions/README.md`)
- 値: `src/config/`
- 管理画面「データ管理」のメニューからドメインを外す: `domain.json` の `addToAdminDataMenu: false`。`adminDataMenu.ts` を手で消しても次の生成で戻る
- 手書きのメニューの行: `src/config/ui/admin-global-menu.config.ts`
