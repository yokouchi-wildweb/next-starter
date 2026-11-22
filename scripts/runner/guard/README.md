# scripts/runner/guard — 書く入口の共通の守り

## Overview

- DB・外部に書く入口すべてが先頭で通す守り(向き先の明示・本番の確認・dry-run の受け渡し)
- 読むだけの入口も向き先の選び方と段階の印の確かめを通す(確認は無し)
- 入口の決まり(`guardEntry` を先頭で呼ぶ・dotenv を自前で読まない・`guard.test.ts` の一覧に足す)は `.claude/rules/core/scripts.md` の write_guard

## Usage

### 向き先

- 既定は開発(`.env.development`)。ほかは `--env <development|staging|production>` で選ぶ
  - 例: `pnpm db:push -- --env production` / `pnpm task wallet:lots-init -- --all --env production`
  - `ENV_FILE=<path>` を渡せばそのファイルを読む(名前の段階は `--env` と一致すること)
- 読むファイル = `.env.<段階>`、あれば `.env.<段階>.local` を上に重ねる(個人の上書き・秘密、git に入れない)
- 値は既にある環境変数を上書きしない

### ホストの env

本番ホストで env ファイルを置かず環境変数を直接渡す場合、ファイルが無く、環境変数の `APP_ENV` が向き先と同じ時だけ、その値で進む。本番は `--env production` の明示と確認(下の「本番の確認」)が要る(例 Vercel 以外のスケジューラ = `pnpm task --due --env production`)。

### 使う側

- 書く入口(`guardEntry({ write: true, ... })`): `pnpm task`・`pnpm ops db seed`・`pnpm workflow dev-admin run`(この 3 つは `scripts/runner/task/prepare.ts` の `loadEnvFile`)・`pnpm db:push`・`pnpm ops db clear`・`pnpm ops db inspect query`・`pnpm ops firestore inspect delete`・`pnpm ops storage setup` / `setup-cors`・`pnpm ops mail test-send`・`pnpm ops data import` / `update` / `delete`
- 読む入口(`write: false`): `pnpm db:push:check`・`pnpm ops db inspect` のほか・`pnpm ops firestore inspect` のほか・`pnpm ops room check`・`pnpm ops claude test`・`pnpm ops data export`
- デプロイ(`guardDeploy`): Internals「デプロイ」
- 入口を足したら先頭で `guardEntry` を呼び、dotenv を自前で読まない(`guard.test.ts` の入口の一覧に足す)
- 守りの旗(`--env`・`--confirm=`)は `process.argv` から外してから入口に渡す。`--dry-run` は入口の物なので残す

## Internals

### 止める(何もしない、exit 1)

- 読むファイルが無い(`.env.production` が無いことは本番を指した時だけ止める)
- 段階の印(env ファイルの `APP_ENV=<段階>` の行)が無い・知らない値・ファイル名(と向き先)の段階と違う。シェルの `APP_ENV` が向き先と違う
- シェルから継いだ `DATABASE_URL` が、向き先のファイル(`.local` を重ねた後)の `DATABASE_URL` と別の DB(host と DB 名で比べる。資格情報や引数の違いは同じ DB)。値は上書きしないので、止めないと検査した DB と繋ぐ DB がずれる。ホストの env は継いだ値そのものなので掛けない
- 本番を指して、本番と開発が同じ DB(host と DB 名)
- 本番の DB に書くのに本番の `DATABASE_URL` が空(リリース前 = 未設定。同じ DB の判定には掛けない)
- 本番に書くのに確認が取れない(下の「本番の確認」)

### 本番の確認(D420)

- 手で打つ(TTY): 「production」と打つ。`--confirm=production` を付けた人は問わない(人の省略)
- 非対話(TTY なし・CI・エージェント): `--confirm=production` の有無にかかわらず、repo.json の方針と人の 1 回分の許可で決める
  - 種類: DB・外部への本番の書き込みとデプロイ = `agent.deploy`(許可 `dep`。本番の DB の反映を含む)/ `pnpm ops vercel env-*` = `agent.env_production`(許可 `evp`)
  - 方針が `off` → 拒否(人が端末で打つ。任せるなら /repo-policy)
  - `manual`(既定)→ 呼んだ所の git の直下の `.agent/devcheck-allow.json` にその許可がある時だけ 1 回通し、許可を消して 1 行出す。無ければ拒否(`/allow dep` / `/allow evp` の案内)
  - 方針と許可の読み手は devcheck の物(`scripts/workflow/devcheck/lib.kinds.mjs` の `agentPolicyFromFile`・`lib.allow.mjs`)。許可を書くのは人の `/allow`(`pnpm workflow devcheck allow`)だけ

### デプロイ

`pnpm live` / `live:app` / `live:room` / `live:all`・`pnpm ops room deploy` / `secret`・`pnpm ops vercel env-add` / `env-rm` / `env-pull` は env ファイルを読まない(ホスティング側の env で動く)。本番に出す時だけ同じ確認(`guardDeploy`)を、何かを打つ前に通す。

- プレビュー(`pnpm live -- --target=preview` など、`--prod` でない vercel)は確認なし
- ルームの Worker は常に本番(realtimeRoom の設定 `enabled` が false なら出さないので確認も無い)
- `pnpm ops vercel env-*`(ホスティング側の env を書く・取る)は向き先が production の時だけ確認(種類 `env_production`、非対話は evp の許可を守りが使って消す。`scripts/operations/vercel/README.md`)。何も出さないのでセーフポイントは見ない
- `live:all`・`live:room` は確認を 1 回だけ取り、ルームの Worker は同じプロセスの中で出す(`scripts/operations/room/lib.deploy.ts`。子の命令にすると、親が使った許可が無いので非対話で通らない)
- 本番に出す時は、確認の後にセーフポイントを確かめる(`pnpm live`・`live:all`・`live:room`・`pnpm ops room deploy` の全部。`scripts/operations/deploy/lib.ts` の `guardSafePoint`。仕様 = `.notices/README.md`「区切り(checkpoint)と区間適用」のセーフポイント)
  - fork = 台帳の最後の `upstream:<sha>` が直接の親の `safe/<親の repo_id>/*` tag ちょうど、Tier1 = HEAD が `safe/<自分の repo_id>/*` tag ちょうど。違えば止める
  - `--allow-unsafe=<理由>` で通す(確認は要る。理由を出す。vercel・wrangler には渡さない)

## Verification

- `pnpm test scripts/runner/guard`(一時の env の束で確かめる。デプロイは偽の vercel で、本物は呼ばない)
