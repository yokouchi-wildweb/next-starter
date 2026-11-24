# scripts/runner/phases — 段階(検査と生成をまとめて回す仕組み)

## Overview

- 検査器・生成器を「段階」(build・/sluice・forge 等、まとめて回す場面)に乗せる仕組みです。上流が段階の一覧を 1 か所(`phases.json`)に持ち、各道具は自分のフォルダに `phase.json` を 1 枚置いて乗る段階を宣言します。段階は毎回フォルダを走査します(一覧は生成しません)。

## Usage

```
pnpm check [<対象>] [--phase=<段階>] [--all] [--range=<前>...<先>] [-- <入口への引数>]
pnpm generate [<対象>] [--phase=<段階>] [--range=<前>...<先>] [-- <入口への引数>]
```

- 対象なし = phase.json を持つ全部の対象の check(generate)を順に回す
- `<対象>` = その対象フォルダ 1 つ(フォルダ名)
- `--phase=<段階>` = その段階に乗る対象だけ
- `--all` = watch を見ずに全部回す(下の「watch」)
- `--range=<前>...<先>` = watch の範囲を、取り込む区間の上流の差分にする(下の「watch」)。/flux が区間の作り直しで渡す。`...` の無い値は exit 2
- リポ = cwd の git の直下。宣言・入口・`features.ts` はそこから読む(遅れた fork で先端の版を `.claude/skills/flux/tip.mjs` で走らせても、その fork の木を読む)
- exit 0 = 全部通る(対象なしも含む)/ 1 = 落ちた・build の検査が外に届いた / 2 = 宣言の誤り

## API

### 段階の一覧(phases.json、上流だけが持つ)

- `phases`: 段階の名前 → `runs`(どこで回るか)・`offline`(true = DB・外部に届いてはいけない)。今の段階: `build`(offline、next build の前)・`build:post`(offline、next build の後に組み上がった物を見る)・`ship`・`forge:pre`・`forge:post`・`deploy`
- `first`: ほかの全部より先に回す対象の名前(この順)。今は `lockfile`(`pnpm install`。ほかの生成器・検査が依存の解決を読むので、D316)。first の対象は after を持たない。無い名前は止める
- `upstreamFolders`: 上流の対象フォルダの名簿(`structure` / `workflow`)。順序で上流と fork を分けるのに使う。上流が対象フォルダを足したらここにも 1 行足す
- `watch: true` の段階(ship)は対象の watch を使う(下の「watch」)
- `explicit: true` の段階(build:post)だけに乗る対象は、全部を回す時(対象も --phase も無し)は飛ばして出す。その段階か対象の名前で呼んだ時だけ回す
- 知らない段階の名前は止める(phase.json の誤り)。段階を増やすのは上流

### phase.json(各対象フォルダに 1 枚)

対象 = `scripts/structure/<名前>/` と `scripts/workflow/<名前>/`。

```json
{ "check": "check.mjs", "generate": "generate.mjs", "phases": ["ship", "forge:post"], "after": ["domain"], "watch": ["src/domains/**/domain.json"], "features": ["coupon"] }
```

- `check` / `generate`: このフォルダの中の入口のファイル名(どちらか必須)。`.mjs` / `.js` は node、`.ts` は tsx(+ `scripts/runner/preload/serverOnly.mjs` の preload)で起動する。env `GATE=<段階 | ->` が付く
- `phases`: 乗る段階(phases.json にある名前だけ)
- `after`: 先に回る対象のフォルダ名。順序 = after を満たす順。after の順で同じ位置に並ぶ物の中では上流(名簿にある物)が先で名前順、名簿に無い fork のフォルダは上流の全部の後に名前順。上流の対象が fork の対象の後を求める宣言と循環は止める
- `watch`: 変更を見るパスの glob(リポジトリ直下からの相対、`**` = 何段でも・`*` = 1 段の中・`?` = 1 文字)。watch の段階で選んだ時に使う(下)
- `features`: 機能名(src/featureGate の規則名)。どれかが閉じていれば飛ばし、「機能 <名前> が閉じているので飛ばした」を必ず出す。知らない機能名は止める
- `outputs`: この生成器が書くファイルの宣言(生成器が出力を宣言する唯一の場所)。1 行 = `{ glob, kind, source, part? }`(全部の生成器で 1 つの形、D318。`glob` = リポジトリ直下からの相対、`kind` = `every-run` 毎回書き直す / `write-once` 無いときだけ書く、`source` = 変えたいときに直す物、`part` = ファイルの中で生成器が持つ部分(区画の名前・JSON の鍵。無い = ファイル丸ごと))。glob の文字列の略記・`kind`・`source` の省略は古い形で、この検査が止める(書き換えは `.notices/20261124-033209-flux-rebuild.outputs-form.mjs`。古い木を読む読み手は略記もそろえて読む)。`every-run` の行は受け口の一覧(src/lib/forkOwnership/intake.txt)の `generated` の行になる(`pnpm generate extensions` が書く。`{dir}` などドメインの置き換えを持つ glob は除く: scripts/structure/domain/README.md)
- `tests`: `check` が `node --test` に渡すテストのファイル(リポジトリ直下からの相対、`*.test.*`)。その一覧の唯一の場所(check.mjs は `scan.mjs` の `phaseTestsOf` で読む)。`check` そのものがテストのファイルの対象(cycles・config)と同じく、`pnpm test` は名指しでない時にこれらを回さない(段階の入口のテストは段階 1 回、D389。`phaseTestFiles`)
- `regions`: この生成器が書き直しても fork の区画(fork entries の対)を残すファイルの glob。受け口の一覧の `region` の行になる
- 知らない欄は止める

## Extension

- 段階に乗せたい生成器・検査器は `scripts/structure/`(開発の進め方の物は `scripts/workflow/`)の直下に新しいフォルダ + phase.json を足します。上流のフォルダの中へのファイル追加・この runner/ の中への追加はしません。ファイル名に fork の名前は入れません。

## Internals

### watch(関係ない変更で無駄な検査を回さない)

`watch: true` の段階(今は ship)で選んだ対象のうち、phase.json に `watch` を持つ物は、範囲の変更が watch のどれにも当たらなければ飛ばし、「変更が watch に当たらないので飛ばした(--all で回す)」を 1 行出します。

- 範囲 = 比べる枝(上流の追跡先 → `origin/<今の枝>` → `origin/HEAD` → `origin/main` の最初にある物)との分岐点から HEAD まで + 作業ツリーの変更 + 未追跡のファイル
- `--range=<前>...<先>` の時の範囲 = `git diff --no-renames --name-only <前>...<先>` だけ(2 点の分岐点から先まで。作業ツリー・未追跡は入れない、改名は元と先の両方)。fork 自身の作業中の変更で生成器を選ばないため
  - この時の phase.json は取り込む区間の木の宣言として読む: outputs の古い形(glob の文字列・kind や source の省略)もそろえて読み、止めない。このリポの宣言としては止める(`scan.mjs` の strict)
- 回す: watch の無い対象・対象の名前で呼んだ時・`--all`・watch の段階でない時・範囲が決まらない時(理由を 1 行出す)
- watch は「この対象の検査を落としうる変更」の glob。迷ったら広めに書く(足りないと壊れた変更が素通りする)
- 上流の対象は段階 ship に乗る物すべてが watch を持つ。structure の対象の範囲は `watchCoverage.test.mjs` が縛る: 検査の入口から dpdm で届くファイルと、入口が fs で読むデータ(表 READS)の全部が watch に当たらなければ落ちる。入口に読む物を足したら表と watch を一緒に直す
- 共通に入れる物: `tsconfig.json`・`package.json`・`pnpm-lock.yaml`(依存と解決)・`scripts/runner/phases/**`・`scripts/runner/preload/**`(起動のしかた)。src 全体を読む検査(admin-menu・config・cron・cycles・extensions・proxies・registry・routes)は `src/**`

### build の守り

offline の段階(build・build:post)に乗る対象の check は、DB・外部の env(`DATABASE_URL*`・`MY_SERVICE_ACCOUNT_KEY`・`NEXT_PUBLIC_FIREBASE_*` 等、`offlineEnv.mjs` の `OFFLINE_ENV`)を外し(未設定にする。空の文字 `""` にはしない: `""` は値なので `??` に残り、`https://${id}.web.app` のような組み立てを壊して、その env を出した build(Vercel・CI)だけで検査が落ちる)、`netGuard.mjs` を preload して起動します。fetch・http(s)・net・tls・dns に届こうとした時点で落とし、「build に宣言した検査が外に届いた」でその宣言を拒みます(検査が例外を握りつぶしても印で分かります)。黙って飛ばしません。

### 走る順

- `run.mjs`(入口)が `scan.mjs` で phase.json を読み・検証し・順に並べて回す。features を持つ対象がある時だけ `features.ts` を子プロセスで呼んで機能の開閉を得る
- 外す env の名前 `OFFLINE_ENV` は `offlineEnv.mjs`(import を持たない。`run.mjs` と `scripts/structure/extensions/select.mjs` が直に読む。`run.mjs` を読むと `netGuard.mjs` が網を塞ぐので、ほかの道具は `run.mjs` から読まない)

## Verification

- `phases.test.mjs` テスト(pnpm test scripts/runner/phases/phases.test.mjs)
- `watchCoverage.test.mjs` 上流の対象の watch が読む物を覆うかのテスト(pnpm test scripts/runner/phases/watchCoverage.test.mjs)
