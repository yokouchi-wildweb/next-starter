# forge（設定を書いた後の生成と検査を 1 回で）

`pnpm forge` は、domain.json・`*.role.json`・`*.profile.json`・cron のタスクを書いた（直した）後に打つコマンド。何を変えたかでコマンドを選ばず、これ 1 つで、作り直せるものを全部作り直し、生成の後の検査を全部回す。

```bash
pnpm forge                 # 全部
pnpm forge --plan pro      # cron の plan の推定を上書き（hobby | pro。保存しない）
pnpm forge --lint          # 最後に lint（eslint . 全体、30 秒ほど）も回す
```

## 段（順に回し、落ちた段で止まる。終了コード 1）

1. 事前検査（何も書かない）: ロール・プロフィールの検査（`scripts/role-config/checks/`）→ `dc:generate:all --dry-run`（domain.json の検査）→ `registry:check`。ここで落ちたら何も書いていない
2. 生成: `role:generate --all` → `dc:generate:all`（`generate: true` のドメインは丸ごと作り直し、`generate: false` は何もしない。`src/features/feature-map.txt` も書き直す）→ `routes:map` → `cron:generate --plan <plan>`
3. 事後検査: `registry:check` → `test:schema-registry` → `test:storage-purposes` → `test:service-registry` → `test:collection-wiring` → `routes:map --check` → `dc:feature-map --check` → `test:screens` → `test:wiring` → `test:feature-gate` → `cron:check` → `typecheck`（→ `lint`）

段の並びは `steps.mjs`。止まったときは表示された段のコマンドで確かめ、直してから `pnpm forge` をもう一度回す（何度回しても、変更が無ければ差分は出ない）。

## cron の plan（`plan.mjs`）

plan（Vercel の Hobby / Pro）はどこにも保存されないので、今の `vercel.json` の crons から推定する。

- `vercel.json` が無い: cron の段と `cron:check` を飛ばす（Vercel の cron を使っていない）
- `/api/cron/` のエントリに 1 日 1 回より細かいもの（分か時が数字 1 つでない）がある: pro
- それ以外: hobby（タスクが全部 1 日 1 回なら hobby と pro は同じ出力）
- JSON として読めない: 止まる（`--plan` を付ける）

限界: 有料（Pro）でも今のタスクが全部 1 日 1 回なら Hobby と区別できない。細かい頻度のタスクを足した最初の forge は Hobby と推定し、そのタスクを 1 日 1 回に落とす（`cron:generate` が落としたタスクを表示する）。Pro なら `pnpm forge --plan pro` で回し直す。

## DB

forge は `db:push` を呼ばない。生成の前後で表の定義（`src/features/*/entities/drizzle.ts`・`src/features/core/userProfile/generated/*/drizzle.ts`）の hash を比べ（`tables.mjs`）、変わっていれば最後にファイルの一覧と「`[user-run] pnpm db:push` → `pnpm db:push:check` が差分 0」を出す。

## テスト

`pnpm test:forge`（段の並び・止まり方・plan の推定と `src/lib/cron/cronExpression.ts` との突き合わせ・hash の比較・引数）。
