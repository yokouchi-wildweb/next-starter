# scripts/workflow/devcheck/items(fork の確かめの項目の受け口)

## Overview

- fork が自分の確かめの項目を 1 項目 1 ファイル(`<名前>.json`)で足す場所。上流はこの README だけを出す(項目のファイルは fork の物)

## API

項目のファイルの形:

```json
{ "name": "seed-shop", "kind": "db-write", "command": "pnpm task seed-shop", "what": "確かめ用の店を開発の DB に作る" }
```

- `name`: 英小文字・数字・ハイフン
- `kind`: `pnpm workflow devcheck plan` の種類のどれか(server・browser・login・db-write・db-delete・env-add)。方針はその種類のものが効く
- `command`: シェルを通さずに打つ 1 つのコマンド。既定はこのリポの入口(`pnpm <package.json の script>` / `pnpm workflow <対象> <動作>` / `pnpm ops <対象> <動作>`)。シェルの記号(`;` `&` `|` `<` `>` `` ` `` `$(`)は打てない

## Internals

- 打てない形の項目(JSON でない・名前・種類・command なし・シェルの記号)は候補に出さず、`plan` に「断った fork の項目」として理由と出す
