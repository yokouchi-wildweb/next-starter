# scripts/runner/guard — 書く入口の共通の守り

DB・外部に書く入口すべてが先頭で通す守り(向き先の明示・本番の確認・dry-run の受け渡し)。読むだけの入口も向き先の選び方と段階の印の確かめを通す(確認は無し)。

## 向き先

- 既定は開発(`.env.development`)。ほかは `--env <development|staging|production>` で選ぶ
  - 例: `pnpm db:push -- --env production` / `pnpm task wallet:lots-init -- --all --env production`
  - `ENV_FILE=<path>` を渡せばそのファイルを読む(名前の段階は `--env` と一致すること)
- 読むファイル = `.env.<段階>`、あれば `.env.<段階>.local` を上に重ねる(個人の上書き・秘密、git に入れない)
- 値は既にある環境変数を上書きしない

## 止める(何もしない、exit 1)

- 読むファイルが無い(`.env.production` が無いことは本番を指した時だけ止める)
- 段階の印 `APP_ENV` が無い・知らない値・ファイル名(と向き先)の段階と違う。シェルの `APP_ENV` が向き先と違う
- 本番を指して、本番と開発が同じ DB(host と DB 名)
- 本番の DB に書くのに本番の `DATABASE_URL` が空(リリース前 = 未設定。同じ DB の判定には掛けない)
- 本番に書くのに確認が取れない:
  - 手で打つ(TTY)なら「production」と打つ
  - 非対話(TTY なし・CI・エージェント)は `--confirm=production` が無ければ拒否する

## ホストの env

本番ホストで env ファイルを置かず環境変数を直接渡す場合、ファイルが無く、環境変数の `APP_ENV` が向き先と同じ時だけ、その値で進む。本番は明示が要る(例 Vercel 以外のスケジューラ = `pnpm task --due --env production --confirm=production`)。

## デプロイ

`pnpm live` / `live:app` / `live:room` / `live:all`・`pnpm ops room deploy` / `secret` は env ファイルを読まない(ホスティング側の env で動く)。本番に出す時だけ同じ確認(`guardDeploy`)を、何かを打つ前に通す。

- プレビュー(`pnpm live -- --target=preview` など、`--prod` でない vercel)は確認なし
- ルームの Worker は常に本番(realtimeRoom の設定 `enabled` が false なら出さないので確認も無い)
- `live:all` は確認を 1 回だけ取り、子の `pnpm ops room deploy` に `--confirm=production` を渡す
- 本番に出す時は、確認の後にセーフポイントを確かめる(`pnpm live`・`live:all`・`live:room`・`pnpm ops room deploy` の全部。`scripts/operations/deploy/lib.ts` の `guardSafePoint`。仕様 = `.notices/README.md`「区切り(checkpoint)と区間適用」のセーフポイント): fork = 台帳の最後の `upstream:<sha>` が直接の親の `safe/<親の fork_id>/*` tag ちょうど、Tier1 = HEAD が `safe/<自分の fork_id>/*` tag ちょうど。違えば止める。`--allow-unsafe=<理由>` で通す(確認は要る。理由を出す。vercel・wrangler には渡さない。`live:all`・`live:room` は子の `pnpm ops room deploy` に同じ `--allow-unsafe=<理由>` を渡す)

## 使う側

- 書く入口(`guardEntry({ write: true, ... })`): `pnpm task`・`pnpm ops db seed`・`pnpm workflow dev-admin run`(この 3 つは `scripts/runner/task/prepare.ts` の `loadEnvFile`)・`pnpm db:push`・`pnpm ops db clear`・`pnpm ops db inspect query`・`pnpm ops firestore inspect delete`・`pnpm ops storage setup` / `setup-cors`・`pnpm ops mail test-send`
- 読む入口(`write: false`): `pnpm db:push:check`・`pnpm ops db inspect` のほか・`pnpm ops firestore inspect` のほか・`pnpm ops room check`・`pnpm ops claude test`
- デプロイ(`guardDeploy`): 上の「デプロイ」
- 入口を足したら先頭で `guardEntry` を呼び、dotenv を自前で読まない(`guard.test.ts` の入口の一覧に足す)
- 守りの旗(`--env`・`--confirm=`)は `process.argv` から外してから入口に渡す。`--dry-run` は入口の物なので残す

テスト: `pnpm test scripts/runner/guard`(一時の env の束で確かめる。デプロイは偽の vercel で、本物は呼ばない)
