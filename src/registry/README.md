# src/registry

業務ドメインを全体で扱うための一覧の置き場。**下流が中身を足す登録口ではない**。ドメインを 1 つ作ると 1 行増える一覧で、ここのファイルは編集しない。

| ファイル | 作られ方 |
|---|---|
| `serviceRegistry.ts`・`schemaRegistry.ts`・`domainConfigRegistry.ts`・`adminDataMenu.ts` | `pnpm registry:generate` が丸ごと生成(`scripts/registry/README.md`)。build の冒頭の `registry:check` が一致を見る |
| `roleRegistry.ts`・`profile*Registry.ts` | `pnpm role:generate` が生成 |
| `storagePurposeRegistry.ts` | `dc:generate` が書く AUTO 区画だけの一時の置き場(手書きの区画は無い) |

## 足したいとき

- 機能ごとの差し込み(ハンドラ・用途・タブなど): 持ち主のドメインの受け口にファイルを置いて `pnpm extensions:generate`(`scripts/extensions/README.md`)
- 値: `src/config/`
- 管理画面「データ管理」のメニューからドメインを外す: `domain.json` の `addToAdminDataMenu: false`。`adminDataMenu.ts` を手で消しても次の生成で戻る
- 手書きのメニューの行: `src/config/ui/admin-global-menu.config.ts`
