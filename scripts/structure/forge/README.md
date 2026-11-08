# forge（設定を書いた後の生成と検査を 1 回で）

`pnpm forge` は、domain.json・`*.role.json`・`*.profile.json` を書いた（直した）後に打つコマンド。何を変えたかでコマンドを選ばず、これ 1 つで、作り直せるものを全部作り直し、生成の後の検査を全部回す。

```bash
pnpm forge          # 全部
pnpm forge --lint   # 事後検査の最後に lint（eslint . 全体、30 秒ほど）も回す
```

## 段（順に回し、落ちた段で止まる。終了コード 1）

生成器・検査器は門で回す(`pnpm check` / `pnpm generate --gate=…`、`scripts/runner/gates/README.md`)。どの道具がどの段に乗るか・順序は各道具の `gate.json`(gates・after)が持つ。

1. 事前検査（何も書かない）: `pnpm check --gate=forge:pre` = ロール・プロフィールの検査(role)→ domain.json の検査(domain、`pnpm generate domain -- --dry-run`)→ 受け口の検査(extensions、`--no-stale`: 一覧のずれは次の生成で直るので見ない)。ここで落ちたら何も書いていない
2. 生成: `pnpm generate --gate=forge:pre,forge:post` = after の順に role(`pnpm generate role -- --all`)→ domain(`pnpm generate domain`。`generate: true` のドメインは丸ごと作り直し、`generate: false` は何もしない。地区の地図 `src/registry/district-map.jsonl` も書き直す)→ registry(src/registry の一覧を走査で丸ごと)→ extensions → routes(ルート地図)
3. 事後検査: `pnpm check --gate=forge:post`(registry・extensions・地区の地図 district-map・routes の地図)→ 門に乗らないテスト `pnpm test scripts/structure/registry/` → `pnpm test scripts/structure/registry/check-storage-purposes.test.mjs` → `pnpm test scripts/structure/registry/serviceRegistry/serviceRegistry.test.mjs` → `pnpm test scripts/structure/registry/collectionWiring/collectionWiring.test.mjs` → `pnpm test src/lib/screens/screens.test.mjs` → `pnpm test src/wiring/wiring.test.mjs` → `pnpm test src/featureGate scripts/structure/proxies` → `typecheck`（→ `lint`）
4. デプロイ先の検査（生成・検査とは別の段）: `pnpm check --gate=deploy`。今は Vercel だけ: cron の検査は `vercel.json` があるときだけ crons が hobby / pro どちらかの生成結果と一致するかを見る(plan は要らない)。無いリポは Vercel にデプロイしていないとみなして飛ばして出す。ずれていれば `pnpm generate cron -- --plan hobby|pro`（契約中のプラン）で作り直す

段の並びは `steps.mjs`。止まったときは表示された段のコマンドで確かめ、直してから `pnpm forge` をもう一度回す（何度回しても、変更が無ければ差分は出ない）。

## cron は forge の外

forge は cron を生成しない。cron のタスク（`src/app/api/cron/<name>/`）を足す・消す・頻度を変えたら、`pnpm generate cron -- --plan hobby|pro` を別に回す（plan はどこにも保存されないので、毎回人が選ぶ。詳細: `src/lib/cron/README.md`）。forge のデプロイ先の検査は、そのずれを見つけて止まるだけ。

## DB

forge は `db:push` を呼ばない。生成の前後で表の定義（`src/features` の `pgTable` を持つ全ファイル。core・`notificationRead` など drizzle.ts でないものも）の hash を比べ（`tables.mjs`）、変わっていれば最後にファイルの一覧と「`[user-run] pnpm db:push` → `pnpm db:push:check` が差分 0」を出す。

## テスト

`pnpm test scripts/structure/forge/tests/forge.test.mjs`（段の並び・止まり方・デプロイ先の検査・hash の比較・引数）。門の選び方と順序は `pnpm test scripts/runner/gates/gates.test.mjs`。
