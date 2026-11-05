# scripts/runner/gates — 門(検査と生成をまとめて回す仕組み)

検査器・生成器を「門」(build・/ship・forge 等、まとめて回す場面)に乗せる仕組みです。上流が門の一覧を 1 か所(`gates.json`)に持ち、各道具は自分のフォルダに `gate.json` を 1 枚置いて乗る門を宣言します。門は毎回フォルダを走査します(一覧は生成しません)。

## 入口

```
pnpm check [<対象>] [--gate=<門>] [-- <入口への引数>]
pnpm generate [<対象>] [--gate=<門>] [-- <入口への引数>]
```

- 対象なし = gate.json を持つ全部の対象の check(generate)を順に回す
- `<対象>` = その対象フォルダ 1 つ(フォルダ名)
- `--gate=<門>` = その門に乗る対象だけ
- exit 0 = 全部通る(対象なしも含む)/ 1 = 落ちた・build の検査が外に届いた / 2 = 宣言の誤り

## 門の一覧(gates.json、上流だけが持つ)

- `gates`: 門の名前 → `runs`(どこで回るか)・`offline`(true = DB・外部に届いてはいけない)。今の門: `build`(offline)・`ship`・`forge:pre`・`forge:post`・`deploy`
- `upstreamFolders`: 上流の対象フォルダの名簿(`structure` / `workflow`)。順序で上流と fork を分けるのに使う。上流が対象フォルダを足したらここにも 1 行足す
- 知らない門の名前は止める(gate.json の誤り)。門を増やすのは上流

## gate.json(各対象フォルダに 1 枚)

対象 = `scripts/structure/<名前>/` と `scripts/workflow/<名前>/`。

```json
{ "check": "check.mjs", "generate": "generate.mjs", "gates": ["ship", "forge:post"], "after": ["domain"], "watch": ["src/features/**/domain.json"], "features": ["coupon"] }
```

- `check` / `generate`: このフォルダの中の入口のファイル名(どちらか必須)。`.mjs` / `.js` は node、`.ts` は tsx(+ server-only の下駄)で起動する。env `GATE=<門 | ->` が付く
- `gates`: 乗る門(gates.json にある名前だけ)
- `after`: 先に回る対象のフォルダ名。順序 = after を満たす順。同じ段では上流(名簿にある物)が先で名前順、名簿に無い fork のフォルダは上流の全部の後に名前順。上流の対象が fork の対象の後を求める宣言と循環は止める
- `watch`: 変更を見るパスの glob(`pnpm test --changed` 等が後で読む)
- `features`: 機能名(src/featureGate の規則名)。どれかが閉じていれば飛ばし、「機能 <名前> が閉じているので飛ばした」を必ず出す。知らない機能名は止める
- 知らない欄は止める

## build の守り

offline の門(build)に乗る対象の check は、DB・外部の env(`DATABASE_URL*`・`MY_SERVICE_ACCOUNT_KEY`・`NEXT_PUBLIC_FIREBASE_*` 等、`run.mjs` の `OFFLINE_ENV`)を空にし、`netGuard.mjs` を preload して起動します。fetch・http(s)・net・tls・dns に届こうとした時点で落とし、「build に宣言した検査が外に届いた」でその宣言を拒みます(検査が例外を握りつぶしても印で分かります)。黙って飛ばしません。

## fork

門に乗せたい生成器・検査器は `scripts/structure/`(開発の進め方の物は `scripts/workflow/`)の直下に新しいフォルダ + gate.json を足します。上流のフォルダの中へのファイル追加・この runner/ の中への追加はしません。ファイル名に fork の名前は入れません。

## ファイル

- `gates.json` 門の一覧と上流の対象フォルダの名簿
- `scan.mjs` gate.json の読み取り・検証・順序
- `run.mjs` 入口(pnpm check / generate)
- `netGuard.mjs` build の検査に付ける preload
- `features.ts` 機能の開閉を JSON で出す(features を持つ対象がある時だけ子プロセスで呼ぶ)
- `gates.test.mjs` テスト(pnpm test:gates)
