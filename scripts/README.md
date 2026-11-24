# scripts/

## Overview

- scripts/ は、アプリの外からこのフレームワークを作り・確かめ・動かすための道具の置き場です。中身は 4 つに分かれます。構成を作り確かめる生成器と検査器(structure)、開発の進め方の道具(workflow)、テスト・運用コマンド・シードを動かすランナー(runner)、手で行う操作と閲覧の道具(operations)。ドメインの持ち物(運用コマンド・移行・シード)はそのドメインに置き、アプリが実行時に読むコードは置きません。
- 編集する時の細かい決まり(phase.json の欄・書く入口の守り・タスクと移行・シード・テストの群・lint の範囲)は `.claude/rules/core/scripts.md`(scripts を開くと読まれる)。

## Usage

### 入口(package.json)

```bash
pnpm dev | build | start | lint | typecheck        # typecheck = next typegen(next-env.d.ts と .next/types を作る)→ tsc
pnpm test [<パス>|--changed|--db|--group=<群>]   # テスト(runner/test/README.md)
pnpm check [<対象>|--phase=<段階>] [--all]           # 検査器(段階ごと、runner/phases/README.md)
pnpm generate [<対象>]                           # 生成器
pnpm task <ドメイン>:<名前> | <定期タスク> | --list | --due | --resolve <runId> succeeded|failed
pnpm ops <対象> <動作> [<引数>...]               # 手で行う操作と閲覧
pnpm workflow <対象> <動作> [<引数>...]          # 開発の進め方の道具
pnpm forge                                       # domain.json / role.json / profile.json から生成 + 検査を一度に
pnpm e2e                                         # 動いているアプリを外から見るテスト(tests/e2e、playwright)
pnpm db:push | db:push:check                     # スキーマを DB に反映 / 読むだけの差分(push は人が打つ)
pnpm live | live:app | live:room | live:all      # デプロイ(本番は確認とセーフポイントが要る。アプリは HEAD の中身だけを上げる)
```

- package.json の行はこれだけ。新しい道具は分類の下のフォルダに置けば入口が拾う(package.json に足さない)
- 段階(`build`・`build:post`・`ship`・`forge:pre`・`forge:post`・`deploy`)と phase.json: [runner/phases/README.md](./runner/phases/README.md)

### よく使う操作

```bash
pnpm ops setup env                                  # .env.development と .env.production を作る(最初の一歩)
pnpm db:push && pnpm ops db seed --all              # DB を作ってシードを入れる
pnpm ops db inspect tables | describe <表> | count [表] | query "SQL" | seqscans [--min-rows=<n>]   # seqscans = seq scan で多く読まれる表(読むだけ)
pnpm ops db clear [--all]                           # データを消す(閉じた機能の表は選べない)
pnpm ops data export|import|update|delete <domain>  # 全ドメイン共通のデータ操作(operations/data/README.md)
pnpm ops features list | set <規則名> on|off        # 機能を閉じる規則の一覧と入切
pnpm workflow worktree new <branch> | sync | remove <path>
pnpm workflow dev-tab run [stop|status]             # 開発サーバーを tmux のタブか裏のプロセスで
pnpm workflow devcheck plan|status|run|cleanup     # 開発中の確かめの事実と候補・実行・片付け
pnpm workflow local-settings show|plan|apply       # 手元の Claude Code の設定(許可の層の印)を整える
pnpm workflow repo-json show|get|set|migrate       # リポ直下の repo.json(名前・段・方針)を読む・書く
pnpm workflow memory facts|header [--apply]        # auto-memory の事実を 1 件 1 行・先頭の区画を正本に(/meditate の材料)
pnpm workflow context facts [--personal]         # 文脈の行ごとの事実(自前の決まり・個人の 2 ファイル、/project-review と /meditate の材料)
pnpm workflow dev-admin run                         # 確認用の管理者を開発用 DB に用意する
pnpm ops room init | deploy | secret | check | dev  # リアルタイムルーム(servers/room/README.md)
pnpm ops vercel status | env-ls | env-add | env-rm | env-pull  # Vercel の操作の口(書くのは agent.env_production と /allow evp、operations/vercel/README.md)
pnpm generate cron -- --plan hobby|pro              # vercel.json の crons を作る
```

各対象の詳細はそのフォルダの README(例 [operations/data/README.md](./operations/data/README.md)・[operations/storage/README.md](./operations/storage/README.md)・[workflow/worktree/README.md](./workflow/worktree/README.md)・[structure/domain/README.md](./structure/domain/README.md)・[structure/registry/README.md](./structure/registry/README.md))。

### ドメインの持ち物(scripts/ の外、ランナーが探して動かす)

- 運用コマンド: `src/domains/<ドメイン>/scripts/tasks/<名前>.ts` = `pnpm task <ドメイン>:<名前>`(例 `pnpm task wallet:reverse-history`・`pnpm task user:bulk-change-status`)
- 移行(notice が名指す 1 回きり): `src/domains/<ドメイン>/scripts/migrations/<名前>.ts`。git に入れない緊急の修正は `<名前>.local.ts`
- シード: `src/domains/<ドメイン>/seed.ts`(`defineSeed`)= `pnpm ops db seed [--all]`
- 実行は毎回 `task_runs`(core の taskRun)に記録し、止める鍵で二度流さない
- 書き方: [src/lib/task/README.md](../src/lib/task/README.md)・[src/lib/seed/README.md](../src/lib/seed/README.md)・[runner/seed/README.md](./runner/seed/README.md)。ドメインに置く理由: [src/domains/README.md](../src/domains/README.md)「ドメインの運用コマンド・移行・シード」

### 書く入口の守りと env

- DB・外部に書く道具は全部、先頭で共通の守りを通る: 向き先の既定は開発(`.env.development`)、本番は `--env production` と確認(非対話は repo.json の方針と人の 1 回分の許可、`scripts/runner/guard/README.md`)、env ファイルの段階の印 `APP_ENV` と接続先を照らし合わせ、開発と本番が同じ DB なら注意の 1 行を出す(止めない)
- env ファイルは `.env.development` と `.env.production` の 2 つ(どちらにも `APP_ENV=<段階>` の 1 行、別の DB)。無ければ `pnpm ops setup env` が両方を作る(上書きしない。既にあるファイルには乱数で作る秘密の鍵のうち無いか空の鍵だけを足す)。個人の上書き・秘密は `.env.<段階>.local`
- 詳細: [runner/guard/README.md](./runner/guard/README.md)・[src/lib/appEnv/README.md](../src/lib/appEnv/README.md)「env ファイル」

## API

### 4 つの分類

| 分類 | 置く物 | 呼び方 | 今の対象 |
|---|---|---|---|
| `structure/` | 生成器と検査器。全部どこかの段階(phase.json)に乗る | `pnpm generate <対象>` / `pnpm check <対象>` | admin-menu・bundle・business・cache・config・config-overrides・cron・cycles・district-map・domain・eslint・extensions・forge・legal・lib-package・message・next-config・proxies・registry・role・routes・styles |
| `workflow/` | 開発の進め方の道具(ワークツリー・規則と notice とスキルの書式の検査・所有の検査・開発サーバーのタブ・tmux・確認用の管理者・開発中の確かめの入口・普通のセッション同士の連絡・手元の Claude Code の設定・auto-memory と文脈の行の事実・リポの名のパスの検査) | `pnpm workflow <対象> <動作>`(段階に乗る物は `pnpm check <対象>` も) | agent-terminal・context・dev-admin・dev-tab・devcheck・local-migrations・local-settings・memory・notices・ownership・peer・repo-json・repo-paths・rules・skills・tmux-launch・worktree |
| `runner/` | 入口と、テスト・運用コマンド・シードを動かすランナー、書く入口の守り | `pnpm test` / `pnpm task` / `pnpm check` / `pnpm ops db seed` の中身 | entries・phases・guard・preload・seed・task・test |
| `operations/` | 手で行う操作と閲覧(DB・Firestore・データ・デプロイ・初期化・storage・ルーム・メール・機能の入切・Claude API・Vercel) | `pnpm ops <対象> <動作>` | business・claude・data・db・deploy・features・firestore・legal・mail・room・setup・storage・vercel |

- 対象 = 分類の下のフォルダ 1 つ。動作 = そのフォルダの直下の `<動作>.ts` / `.mjs`(`*.test.*`・`lib.*`・下のフォルダの中は動作にならない)。`pnpm ops` / `pnpm workflow` を引数なしで打つと一覧
- 入口の仕組み: [runner/entries/README.md](./runner/entries/README.md)

## Extension

### fork が足せる物

- 新しい対象のフォルダ 1 つ: 段階に乗せる生成器・検査器は `structure/<名前>/`(phase.json を置く)、開発の道具は `workflow/<名前>/`、手で行う操作は `operations/<名前>/`。入口と段階が拾う
- 上流のフォルダの中にファイルを足さない(`pnpm workflow ownership check` が止める)。特定のドメインの道具はそのドメインの `scripts/` へ
- 動いているアプリを外から見るテスト(E2E・アクセシビリティ)は fork の `tests/` へ(scripts/ に置かない)

### 置かない物

- アプリが実行時に読むコード・業務の処理(ドメインかライブラリ `src/lib` へ)
- 特定のドメインの運用コマンド・移行・シード(そのドメインへ)
- 道具とアプリが両方使う部品(`src/lib` へ。例 `src/lib/cron`・`src/lib/task`・`src/lib/seed`)

## Internals

### 置き場の境目(lint、全 Tier で error)

- `import-boundaries/src-no-scripts`: `src/**`(テストも)は `scripts/**` を import しない。道具の側を確かめるテストは `scripts` の側に置く
- `import-boundaries/scripts-no-static-wiring`: 道具(`scripts/**`・`src/domains/**/scripts/**`・`.notices` の codemod)は `src/wiring` を静的に import しない。使う時は run の中で `await import("@/wiring/…")`
- `import-boundaries/tools-no-db-write`: ドメインの `src/domains/<ドメイン>/scripts/tasks`・`scripts/operations`(`operations/db` を除く)・`seed.ts`・`scripts/workflow/dev-admin` は DB を直接書く部品(`@/lib/drizzle` の db・表の定義・drizzle-orm の `sql`・接続のドライバ)を読まない。書くのはドメインのサービスを通す。直接の SQL が要るなら移行
- 3 本とも必須の規則(`eslint-rules/required-rules.mjs`)。fork が off / warn にすると `pnpm build` の `pnpm check eslint` が止まる。行ごとの例外は理由付きの eslint-disable

## Verification

- `pnpm test`(群・絞り方・フラグ: [runner/test/README.md](./runner/test/README.md))。server-only の下駄と module mocks は入口が常に付けるので、テストにも package.json にも書かない
- この README の名指しが実在するかは `pnpm test scripts/runner/entries/readme.test.mjs`
