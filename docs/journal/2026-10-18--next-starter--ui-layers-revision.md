# 2026-10-18 UI レイヤーを 4 つから 3 つに整理

> owner: next-starter

`docs/!must-read/UIレイヤーの概念とコンポーネント分割方法.md` から移した改訂の記録（本文は現行の定義だけにするため）。

## 改訂内容

- 旧版の 4 レイヤー（ページ / セクションコンテナ / ユニットアイテム / インタラクション部品）を 3 レイヤーに整理した
- ユニットアイテムとインタラクション部品は「部品」に統合した
- セクションコンテナは「書き方」（`<Section>` タグ、フォルダ）ではなく「役割」（Screen が直接配置するもの）で定義し直した

## 改名（checkpoint ui-layers-rename）

core の `*Page` という名前のセクションコンテナ 6 件を、接尾辞なしに改名した。

- `WalletIndexPage` → `WalletList`
- `WalletBalancePage` → `WalletBalance`
- `WalletHistoryPage` → `WalletHistory`
- `WalletPurchasePage` → `WalletPurchase`
- `BankTransferInstructionPage` → `BankTransferInstruction`
- `InviteCodePage` → `InviteCode`

`user/components/UserMyPage/` 直下のコンテナは `user/components/<Name>` に昇格した。

旧パスの `@deprecated` 再 export（shim）は 1 checkpoint だけ残し、checkpoint ui-layers-shim-removal で削除した（旧パスの import は `tsc` が止める）。`deprecated-imports/no-deprecated-path`（eslint）は次の改名のために仕組みだけ残している。

関連 notice: `.notices/20261019-000000-ui-layers-vocabulary.md`、`20261019-010000-ui-layers-rename.md`、`20261019-030000-ui-layers-shim-removal.md`
