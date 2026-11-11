# scripts/runner/gates — 門(検査と生成をまとめて回す仕組み)

検査器・生成器を「門」(build・/ship・forge 等、まとめて回す場面)に乗せる仕組みです。上流が門の一覧を 1 か所(`gates.json`)に持ち、各道具は自分のフォルダに `gate.json` を 1 枚置いて乗る門を宣言します。門は毎回フォルダを走査します(一覧は生成しません)。

## 入口

```
pnpm check [<対象>] [--gate=<門>] [--all] [-- <入口への引数>]
pnpm generate [<対象>] [--gate=<門>] [-- <入口への引数>]
```

- 対象なし = gate.json を持つ全部の対象の check(generate)を順に回す
- `<対象>` = その対象フォルダ 1 つ(フォルダ名)
- `--gate=<門>` = その門に乗る対象だけ
- `--all` = watch を見ずに全部回す(下の「watch」)
- exit 0 = 全部通る(対象なしも含む)/ 1 = 落ちた・build の検査が外に届いた / 2 = 宣言の誤り

## 門の一覧(gates.json、上流だけが持つ)

- `gates`: 門の名前 → `runs`(どこで回るか)・`offline`(true = DB・外部に届いてはいけない)。今の門: `build`(offline、next build の前)・`build:post`(offline、next build の後に組み上がった物を見る)・`ship`・`forge:pre`・`forge:post`・`deploy`
- `upstreamFolders`: 上流の対象フォルダの名簿(`structure` / `workflow`)。順序で上流と fork を分けるのに使う。上流が対象フォルダを足したらここにも 1 行足す
- `watch: true` の門(ship)は対象の watch を使う(下の「watch」)
- `explicit: true` の門(build:post)だけに乗る対象は、全部を回す時(対象も --gate も無し)は飛ばして出す。その門か対象の名前で呼んだ時だけ回す
- 知らない門の名前は止める(gate.json の誤り)。門を増やすのは上流

## gate.json(各対象フォルダに 1 枚)

対象 = `scripts/structure/<名前>/` と `scripts/workflow/<名前>/`。

```json
{ "check": "check.mjs", "generate": "generate.mjs", "gates": ["ship", "forge:post"], "after": ["domain"], "watch": ["src/features/**/domain.json"], "features": ["coupon"] }
```

- `check` / `generate`: このフォルダの中の入口のファイル名(どちらか必須)。`.mjs` / `.js` は node、`.ts` は tsx(+ server-only の下駄)で起動する。env `GATE=<門 | ->` が付く
- `gates`: 乗る門(gates.json にある名前だけ)
- `after`: 先に回る対象のフォルダ名。順序 = after を満たす順。同じ段では上流(名簿にある物)が先で名前順、名簿に無い fork のフォルダは上流の全部の後に名前順。上流の対象が fork の対象の後を求める宣言と循環は止める
- `watch`: 変更を見るパスの glob(リポジトリ直下からの相対、`**` = 何段でも・`*` = 1 段の中・`?` = 1 文字)。watch の門で選んだ時に使う(下)
- `features`: 機能名(src/featureGate の規則名)。どれかが閉じていれば飛ばし、「機能 <名前> が閉じているので飛ばした」を必ず出す。知らない機能名は止める
- `outputs`: この生成器が書くファイルの宣言(生成器が出力を宣言する唯一の場所)。1 行 = glob の文字列(リポジトリ直下からの相対、= `every-run`)か `{ glob, kind?, source? }`(`kind` = `every-run` 毎回書き直す(省略時)/ `write-once` 無いときだけ書く、`source` = 変えたいときに直す物)。`every-run` の行は受け口の一覧(src/lib/forkOwnership/intake.txt)の `generated` の行になる(`pnpm generate extensions` が書く。`{dir}` などドメインの置き換えを持つ glob は除く: scripts/structure/domain/README.md)
- `regions`: この生成器が書き直しても fork の区画(fork entries の対)を残すファイルの glob。受け口の一覧の `region` の行になる
- 知らない欄は止める

## watch(関係ない変更で無駄な検査を回さない)

`watch: true` の門(今は ship)で選んだ対象のうち、gate.json に `watch` を持つ物は、範囲の変更が watch のどれにも当たらなければ飛ばし、「変更が watch に当たらないので飛ばした(--all で回す)」を 1 行出します。

- 範囲 = 比べる枝(上流の追跡先 → `origin/<今の枝>` → `origin/HEAD` → `origin/main` の最初にある物)との分岐点から HEAD まで + 作業ツリーの変更 + 未追跡のファイル
- 回す: watch の無い対象・対象の名前で呼んだ時・`--all`・watch の門でない時・範囲が決まらない時(理由を 1 行出す)
- watch は「この対象の検査を落としうる変更」の glob。迷ったら広めに書く(足りないと壊れた変更が素通りする)
- 上流の対象は門 ship に乗る物すべてが watch を持つ(structure の 9 つと workflow の notices・rules)。structure の対象の範囲は `watchCoverage.test.mjs` が縛る: 検査の入口から dpdm で届くファイルと、入口が fs で読むデータ(表 READS)の全部が watch に当たらなければ落ちる。入口に読む物を足したら表と watch を一緒に直す
- 共通に入れる物: `tsconfig.json`・`package.json`・`pnpm-lock.yaml`(依存と解決)・`scripts/runner/gates/**`・`scripts/runner/preload/**`(起動のしかた)。src 全体を読む検査(cycles・config・cron・extensions・registry・routes)は `src/**`

## build の守り

offline の門(build・build:post)に乗る対象の check は、DB・外部の env(`DATABASE_URL*`・`MY_SERVICE_ACCOUNT_KEY`・`NEXT_PUBLIC_FIREBASE_*` 等、`run.mjs` の `OFFLINE_ENV`)を空にし、`netGuard.mjs` を preload して起動します。fetch・http(s)・net・tls・dns に届こうとした時点で落とし、「build に宣言した検査が外に届いた」でその宣言を拒みます(検査が例外を握りつぶしても印で分かります)。黙って飛ばしません。

## fork

門に乗せたい生成器・検査器は `scripts/structure/`(開発の進め方の物は `scripts/workflow/`)の直下に新しいフォルダ + gate.json を足します。上流のフォルダの中へのファイル追加・この runner/ の中への追加はしません。ファイル名に fork の名前は入れません。

## ファイル

- `gates.json` 門の一覧と上流の対象フォルダの名簿
- `scan.mjs` gate.json の読み取り・検証・順序
- `run.mjs` 入口(pnpm check / generate)
- `netGuard.mjs` build の検査に付ける preload
- `features.ts` 機能の開閉を JSON で出す(features を持つ対象がある時だけ子プロセスで呼ぶ)
- `gates.test.mjs` テスト(pnpm test scripts/runner/gates/gates.test.mjs)
- `watchCoverage.test.mjs` 上流の対象の watch が読む物を覆うかのテスト(pnpm test scripts/runner/gates/watchCoverage.test.mjs)
