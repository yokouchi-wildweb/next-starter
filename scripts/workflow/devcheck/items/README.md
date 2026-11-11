# scripts/workflow/devcheck/items(fork の確かめの項目の受け口)

fork が自分の確かめの項目を 1 項目 1 ファイルで足す場所。上流はこの README だけを出す(項目のファイルは fork の物)。

```json
{ "name": "orders-smoke", "kind": "test", "command": "pnpm test src/features/order", "what": "注文の通しのテスト" }
```

- `name`: 英小文字・数字・ハイフン | `kind`: `pnpm workflow devcheck plan` の種類のどれか(server・browser・login・db-write・db-delete・env-add・test・check)。方針はその種類のものが効く
- `command`: このリポの入口だけ(`pnpm <package.json の script>` / `pnpm workflow <対象> <動作>` / `pnpm ops <対象> <動作>`)。シェルの記号(`;` `&` `|` `<` `>` `` ` `` `$(`)・`--env`・`--confirm`・`db:push` は使えない
- 使えない項目は候補に出さず、`plan` に「断った fork の項目」として理由と出す
