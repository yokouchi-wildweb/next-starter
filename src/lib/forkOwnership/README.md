# forkOwnership

fork が upstream(直接の親 Tier)のファイルを、決められた場所の外で書き換えていないかを調べる検査の仕様。

`/flux` が各区間のコミットの後・push の前に `pnpm ownership:check` を走らせる(下の「使い方」、`.claude/skills/flux/SKILL.md` 手順 7c)。部品: 受け口の一覧(`intake.txt`、読み取り `intake.mjs`)、判定の核(`judge.mjs`)、単位名(`unitNames.mjs`)、一時許可の照合(`permits.mjs`)、区画の読み取り(`regions.mjs`)、点つきの名前の分類(`dottedNames.mjs`)、拡張点の宣言の読み手(`declarations.mjs`、生成器 `scripts/extensions` も使う)は git に触れない純粋関数。git を扱うのは検査の本体(`check.mjs`)とコマンド(`cli.mjs`)、持ち主の問い合わせ(`who.mjs` と コマンド `whoCli.mjs`、下の「持ち主を調べる」)だけ。決定の経緯と見送った案は [docs/journal/2026-10-29--next-starter--fork-ownership-decisions.md](../../../docs/journal/2026-10-29--next-starter--fork-ownership-decisions.md)。

## 目的

- 全ファイルの持ち主を書き出すことはしない。持ち主を知る必要がある場面(lint の厳しさ・削除と書き換えの検査・notice)ごとに、必要な範囲だけを決める
- 受け口の外を変える必要が出たら、まず直接の親へ改良を依頼する(`/order <親>`)。upstream の汎用化の不足を、依頼を通して直していく

## 判定

- 基準 = 直接の親 Tier から最後に取り込んだ版(`/flux` の base と同じ merge-base)。その上で、Tier1 の版にあるファイルだけを厳密に判定する(多段、下の「多段の Tier」)
- 所有台帳は作らない。基準との git の比較(`git diff --name-status -M <基準> HEAD`)だけで決める。ファイル名に fork の名前の印は使わない(D137。fork の物 = 基準に無く fork が足したファイル。fork の名前は台帳・一時許可・CATALOG の節にだけ使う)
- fork が先に作り、後で親が同じパスに足したファイルは、取り込んだ時点で親の物(基準に入るので自然にそうなる)
- 判定の順(`judge.mjs`。reason ごとの合否は `REASONS`)
  1. A(fork が足した)→ `added`。ただし次は違反(上から順に)
     - 基準の `src/lib/<name>/` が実在する `<name>` の中 → `ancestor-lib-add`(自分の lib に置いて re-export する)。祖先の lib かどうかは基準の git だけで決まるので、`folderCatalog` の目録は使わない
     - 基準に `src/features/core/` があり、足したパスがその中で受け口(`intake.txt` の debt 以外の行)に当たらない → `core-add`(fork のドメインは `src/features/<x>/`、画面の部品は route の `_components/`)
     - 基準に `src/featureGate/`(門番)があり、足したパスがその中で受け口に当たらない → `gate-add`(足せるのは `rules/`・`alwaysOnExceptions/`・`required/` の `<名前>.ts`)
     - 検査する場所への追加で、単位名が基準のファイルと同じ → `unit-clash`(下の「単位名」。`x.ts` と `x.tsx`、ファイルとフォルダの組。別の名前にするか、丸ごと置き換えは `<名前>.replace`)
     - `<対象>.override.ts(x)` で、対象が基準に無い → `override-own`(fork が自分で足した項目への override。fork の項目は直接書き換える。中間 Tier の項目は下の Tier の基準にあるので可)
     - `<名前>.default.<拡張子>` で、同じフォルダに基準のファイルがある → `default-add`(既定はそこを作ったリポの物。fork は既定の上に重ねる側に書く、例 `frame.default.ts` の隣の `frame.ts`。自分のフォルダの自分の既定は可、中間 Tier も自分のルートに出してよい)
  2. D → `deleted`、R(元が基準にある)→ `renamed`。受け口の中でも違反(config の削除、`_` 付きへの rename も)
  3. M → 基準の `<名前>.default.<拡張子>` の書き換えは `default-edit`(違反、受け口の行より先に見る)。それ以外は受け口の一覧で当たった kind ごと(下の表)。どれにも当たらなければ、生成器の区画の中だけの差なら `generator-region`(合格)、それ以外は `outside-intake`(違反)
- 生成器の区画(`AUTO-GENERATED-START/END`・`=== AUTO-GENERATED … START/END ===`・終わりの印の無い `// --- Auto-generated imports ---` = 続く import の行まで・道具が丸ごと書き足す `<!-- BEGIN:nextjs-agent-rules -->` 〜 END = 印の行と直前の空行ごと)は検査の対象外。生成器の印の統一は別の論点
- 区画の中身を除いたテキスト(`stripOwnedRegions`)が基準側と fork 側で同じ = 区画の中だけの書き換え。一時許可の指紋もこのテキストから取る。`#` でコメントを書くファイルの対 `# === AUTO-GENERATED <name> START/END ===` も生成器の区画(`intake.txt` の受け口の行)

## 単位名(unitNames.mjs)

印の代わりの同名の検査(計画書 01 S2)。単位名 = パスから最後の拡張子と末尾の `/index` を除いた名前(`.replace` / `.override` は名前に残す)。

- 検査する場所(これだけ。components・hooks・utils・`src/lib` は対象外)
  - 直下の項目だけ: 基準の `src/**/extensionPoints.ts` の受け口のフォルダ(宣言は `declarations.mjs` で読む、`dir: "."` = 持ち主の直下)・`src/wiring`・`scripts`・`scripts/tasks`(門番の例外 `src/featureGate/alwaysOnExceptions` は宣言の受け口)
  - その下全部: route の隣(`src/app/**/_layout`・`_screen`・`_components`)
- `unit-clash`・`override-own`・`default-add`・`default-edit` は持ち主によらず止める(下の多段で `middle-tier` に付け替えない)
- fork が足したファイルの一覧だけが要る検査(featureGate の規則の重なりなど)は `forkAddedFiles(repoRoot, { parent, branch, fetch })` を使う: Tier1 は git に触れず空、基準が求められなければ `unverified`(合格にしない)

## 受け口の一覧

- `intake.txt` = fork が書き換えてよい場所の一覧。upstream が持ち、検査は**取り込み済みの upstream 側の版**から読む(fork が一覧を広げて自分を許すことはできない)
- 書式: 1 行 1 規則 `<kind> <glob>  # 理由`(理由は必須)。`!<glob>` はそれまでに当たった規則を外す。最後に当たった規則が効く。glob は `node:path` の `matchesGlob`
- kind と、M(書き換え)の合否

  | kind | 合格 | 違反 |
  | --- | --- | --- |
  | edit | 何を書き換えても `intake` | — |
  | add | — (足すのは A なので `added`) | 基準にあるファイルの書き換え `outside-intake` |
  | region | fork の区画(印の対)と生成器の区画の外が基準と同じ → `region` | 外も変えた `outside-region` / 印の対が壊れている `region-markers` |
  | marker | `fork entries below` の行までが基準と同じ → `marker` | `above-marker`(印が無い場合も) |
  | append | 基準の中身が先頭にそのまま残る → `append` | `not-append` |
  | generated | 生成物 → `generated` | — |
  | debt | — | `debt`(upstream の負債の箇所。一時許可で通す) |

- 載せている物(手書き): リポジトリ直下の 6 種(package.json・pnpm-lock.yaml・.gitignore・.env.example・next.config.ts・.mcp.json)と README.md・`eslint.config.fork.mjs`(下)/ ロゴ・favicon / `src/config/**`(config の再設計までは全体、値とキーを区別しない。Tier1 の config の規則はそのまま)/ `src/styles/*.css` / 1 行スイッチの素の名前(page.tsx・枠の layout.tsx・core の 1 行スイッチ)/ `_components/**` / cron の `task.override.ts` / `domainEntry.override.ts`・ロールとプロフィールの override / registry と room・seed の登録点(region)・デモの利用者の値・room の wrangler.toml / `.claude/rules` の PER_PROJECT と marker のファイル / `src/lib/CATALOG.md`(append)/ 生成物
- 受け口の行(生成区画 `# === AUTO-GENERATED intake START ===` 〜 `END`): `pnpm extensions:generate` が拡張点の宣言と 1 行スイッチから書き、ずれは `pnpm extensions:check` が止める(手で編集しない、`scripts/extensions/README.md`「受け口の一覧の生成区画」)。行は全部 `add`: 宣言の受け口のフォルダ(`<dir>/*.{ts,tsx}` とフォルダ形 `<dir>/*/**`)・1 行スイッチの `<名前>.replace`・`_layout` / `_screen` の隣の `*.replace`・`scripts/tasks/*.ts`。区画は生成器の区画なので、fork が自分の受け口の行を足して作り直しても合格(検査は基準の区画を読む)。既知の穴: フォルダ形の行は上流のフォルダ項目の中への fork のファイル追加も通す(第 2 段の棚の検査へ)
- 一覧の鮮度: `pnpm test:fork-ownership` が書式と、各 glob の固定の部分(最初の `*` より前)が実在することを見る(fork だけが作るファイルは upstream に無いので、glob そのものの当たりは見ない)。fork が作るファイルを名指しする行は、理由に「upstream には無い」と書いて外す。生成区画の行は見ない(項目 0 の受け口はフォルダが無い)
- 外のままにした物と理由: `eslint.config.mjs`(fork の設定は `eslint.config.fork.mjs` に書く。upstream は空の配列で出荷し、`eslint.config.mjs` が最後に読み足す)/ `tsconfig.json`(paths の不足は upstream で直す。要るなら一時許可 + 依頼)/ `AGENTS.md`(ただし `next dev` が書き足す `<!-- BEGIN:nextjs-agent-rules -->` の区画は、印の行ごと生成器の区画として除く。Next の版で中身が変わるので upstream に固定で置けない)/ 既存の `eslint-rules/*.mjs` の書き換え(新しい規則のファイルは追加なので合格)
- 負債の行(debt): upstream 自身が core の中のファイルを下流の編集点として案内している箇所。fork 側には何も書かせず、upstream が負債として一覧に載せ、core の外に受け口を用意した notice で外す
  - 載せる基準: 案内が「core の中のこのファイルを fork が編集・差し替える」で、受け口(edit / region・fork が足すファイル・`src/config/**`)で済まない物。登録の API(`register*()`)を fork のファイルから呼べる物、fork が新しいファイルを足すだけの置き場は載せない
  - 理由の欄 = 案内の所在 → 受け口づくりの依頼の番号(`upreq:<id>`)。fork がその箇所を書き換えるときは、この番号を書いた一時許可で通す
  - 件数: Tier1 で `pnpm ownership:check` が「対象外 — upstream の負債の行 n」(`--verbose` でパスも)、`pnpm test:fork-ownership` が diagnostic で出す。`/inbox` の一覧の先頭にも出る
  - 負債の行が実在しないファイルを指す・依頼の番号が無いと `pnpm test:fork-ownership` が失敗する
- 中間 Tier の一覧にも「下流が消してよい」行は作らない。要らない物は持ち主が自分で消し、merge で流す
- API: `parseIntake(text)` → `{ rules, errors }` / `matchIntake(rules, path)` → 効く規則か `null` / `replaceIntakeBlock(text, rows)` → 生成区画を入れ替えたテキスト / `judge({ changes, baseText, headText, baseLibs, baseHasCore, baseHasGate, intake, places, baseUnits })` → `{ entries: [{ status, path, from, kind, reason, verdict, clash }], counts }`(`places` = `unitPlaces(基準のファイル, 基準の中身)`、`baseUnits` = `unitIndex(基準のファイル)`。渡さなければ単位名の検査をしない。`clash` = unit-clash の相手の基準のパス)

## 一時許可

受け口の外の書き換えを、直接の親への依頼が片付くまでの間だけ通す行。例外の置き場はこれ 1 つ(猶予の区画は作らない)。

- 対象
  - 受け口が無い固有の機能、upstream のバグ・性能・セキュリティの修正。既存の受け口で済む物には出さない(受け口へ移す)。`_components/` へのコピーに変えない処理や守りが付いてくるなら、済むとは数えない(`.claude/rules/core/extensions.md`)
  - upstream の負債の箇所(debt)。受け口ができた notice で外す
  - 削除・rename(D/R): 付ける依頼は「止める受け口(feature-gate 等)を用意してほしい」に限る。受け口ができたら、止めてから復元する
  - 祖先 lib への追加: 付ける依頼は「その lib に入れてほしい / 受け口がほしい」に限る(ふつうは自分の lib に置いて re-export する)
- 置き場: `.fork-ownership/<名前>.permits.txt`(名前 = 自分の `fork_id:`。`.notices/applied/` の台帳名と同じ)。fork が足すファイルなので fork の物。多段の Tier では親の許可ファイルも基準に入るが、読むのは自分の fork-id のファイルだけ(親の許可を子が借りない)
- 書式: 1 ファイル 1 行
  ```
  <path> upreq:<id>[,<id>…] base:<指紋|-> head:<指紋|->  # 理由
  ```
  - upreq = 直接の親の受信箱の指令 id(`<YYYYMMDD-HHMMSS>-<slug>`)を 1 つ以上
  - 指紋 = 区画の中身を除いたテキストの git blob id(`git hash-object --stdin` と同じ値)。kind が region のファイルは fork の区画と生成器の区画を、他は生成器の区画だけを除く。区画の中の書き換えでは許可し直しにならない
  - `-` = そのファイルが無い: D/R の head、祖先 lib への追加の base。R は移動元のパスに書く
- 判定(`checkPermits`)

  | 状態 | 条件 | 合否 |
  | --- | --- | --- |
  | valid | 両方の指紋が今と同じ、解決していない依頼が残る | 合格(`permitted`) |
  | refresh | fork 側の指紋が違う(許可の後に書き換えた) | 失敗(中身を見て許可し直す) |
  | expired-base | 基準側の指紋が違う(親がそのファイルに触った) | 失敗(取り込んだ親の版で見直す) |
  | expired-resolved | すべての依頼が解決済み | 失敗(親の受け口へ移す・元に戻す) |
  | same-as-base(残骸) | 基準と同じに戻った | 失敗(行を消す) |
  | unused(残骸) | 違反の無いファイルの行 | 失敗(行を消す) |

- 依頼の解決: 親が依頼を片付けて出荷するとき、notice の `resolves:` 欄に依頼の番号を書く(下流から来た依頼なら必ず。`.notices/README.md`「解決(resolves)」)。`pnpm ownership:check` は基準(取り込み済み)の消えない索引 `.notices/shipped/*.md` の行と本文(`.notices/` と `done/`)の `resolves:` を集め(和をとる。親が本文を片付けても索引の行で失効は変わらない)、すべての番号が解決した許可を expired-resolved にする。`/flux` は区間の計画で、流入する `resolves:` のうち自分の許可に当たる行を示す
- 却下: 親は却下・取り下げで閉じた依頼にも `resolves:` を書くので、許可は失効する。fork は元に戻す・受け口へ移す・別の方針で許可し直す、のどれかを必須にする(`/flux`・`/wen` が一覧に出す)
- 修正だけ先に取り込めるのは、親が `hotfix:` を宣言した notice の commit と、親が索引の行に `pick:clean` を付けた修正の notice の commit だけ(下の「緊急修正の pick」。台帳の `picked:` の扱いは同じ)
- API: `parsePermits(text)` → `{ permits, errors }` / `blobId(text)` / `fingerprint(text, kind)` / `checkPermits({ entries, permits, baseText, headText, intake, resolvedUpreqs })` → `{ entries(permit・verdict 付き), leftovers }` / `permitsPath(forkId)`

## 緊急修正の pick

親の緊急修正・先に取れる修正(`pick: clean`)を cherry-pick しても基準は動かないので、受け口の外のファイルはそのままだと違反になる。台帳の `picked:<sha>` がこれを通す。

- 台帳の行: `upstream:` は今の merge-base のまま(進めると Tier1 の版の判定がずれる)、`picked:` に pick の元の commit を書く(`.notices/README.md`「緊急修正(hotfix)」)
- 判定: 基準に pick を順に当てた中身と HEAD の中身が同じファイルを `picked`(合格)にする。fork が更に変えた・fork の編集が元からある・元の commit が取得できないときは違反のまま(直し方は一時許可)
- 既に基準に入った pick は対象から外れる(merge の後は差分に出ない)

## 導入の段階

1. registry の下流の印を 1 種類(開始と終了の対)に統一する(済み。下の「registry の fork の区画」)
2. 受け口の一覧・判定器・検査を入れる。検査は最初から失敗にする(報告だけの段階は置かない)。fork が消したくなり得るルートを feature-gate で止められるように棚卸しする(済み。`/flux` の各区間に組み込み、片付けの notice `20261029-223134-fork-ownership-cleanup` と同じ出荷)

検査を入れた時点で fork に既にある書き換え・削除・rename・祖先 lib へのファイルの追加は、導入と同時に片付ける。猶予の区画は作らない。

- 片付け方は 3 つのどれか: 受け口へ移す / 元に戻す / 一時許可(直接の親への依頼の番号付き)
- upstream の負債の行(受け口が無い物)に当たる分は、一時許可でいったん通し、受け口ができた notice で外す
- 削除・rename は、feature-gate で止める受け口を用意したうえで「止める → 復元」の順で戻す(すぐ戻すとビルドが壊れたり、復元したページが公開されたりする)

## registry の fork の区画

- `src/registry/` と、受け口の一覧で region にしたファイル(`servers/room/src/registry.ts`・`scripts/db/seed/data/registry.ts`・`index.ts`)の中で fork が書いてよいのは、次の印の対の間だけ。印の外は upstream の物
  ```ts
  // --- fork entries start (upstream never edits inside) ---
  // --- fork entries end ---
  ```
- 1 ファイルに複数の対を置ける。fork の登録は import を伴うので、import 文の後にも対を置く
- 文言は `.claude/rules/` の marker(`fork entries below (upstream never edits below this line)`)と語を揃えている
- upstream は対の中を編集しない。区画を足す・動かすときは notice で知らせる
- 生成器の区画(`AUTO-GENERATED` 系)は fork の区画ではない(生成器の印の統一は別の論点)
- 古い下流の印 3 通り(`// --- DOWNSTREAM (downstream で追加) ---` / `// --- ここに…（上流は空。下流が追記） ---` / `// --- FORK (手書き) ---`)は、`regions.mjs` が移行のために読める(終わりは字下げの浅い閉じ括弧)。ただし `pnpm test:fork-regions` は残っていれば失敗にする
- API(`regions.mjs`、Node 組み込みだけの `.mjs`)
  - `parseForkRegions(text)` → `{ regions: [{ start, end, legacy }], errors: [{ line, message }] }`(行は 1 始まり、start / end は印の行)
  - `isInForkRegion(regions, line)`: その行が区画の中(印の行を除く)か
  - `FORK_REGION_START` / `FORK_REGION_END` / `LEGACY_FORK_MARKERS`
- 生成器の区画の読み取りも同じファイル: `parseGeneratorRegions(text)` / `stripOwnedRegions(text, { fork })`
- 検査: `pnpm test:fork-regions`(`regions.test.mjs`)= 受け口の一覧で region の全ファイルの対が閉じている・入れ子が無い・文言が正しい・古い印が無い + 部品の単体テスト

## 使い方

```sh
pnpm ownership:check            # fork の中で。commit 済みの HEAD を見る(作業ツリーの未 commit は見ない)
pnpm ownership:check --json     # 機械向け(CI・集計)
pnpm ownership:check --verbose  # 合格したパスも並べる
pnpm ownership:check --parent=upstream --branch=main
```

- 終了コード: 0 = 合格(Tier1 は「親なし: 対象外」)/ 1 = 違反あり / 2 = 未検証・設定の不足(合格にしない)
- `/flux`: 基準に `intake.txt` がある区間は、区間を commit した後・push の前に走らせ、1 と 2 は停止条件(片付けを追加の commit で積み、0 になってから push する。`.claude/skills/flux/SKILL.md` 手順 7c)。検査は commit 済みの HEAD だけを見るので、commit の前には置けない
- 出力: 先頭に結論と基準(remote・branch・base)、reason ごとの件数、違反と一時許可の残骸・書式の誤りの一覧
- 一時許可の依頼の出し方は `/order`「一時許可の依頼」、依頼の状況は `/wen permits`、放置と project.md の食い違いは `/flux` の最終報告(上流への所見 (e)(f))に出る
- 違反には、今の指紋で書いた**一時許可の行の下書き**が付く(指紋は区画の中身を除いた blob なので、素の `git hash-object` では出せない)。一時許可で片付けるときは、`<依頼の番号>` と `<理由>` を埋めて `.fork-ownership/<名前>.permits.txt` に貼り、commit してから検査し直す
- 手順(`check.mjs` の `runCheck`)
  1. 名前と Tier1 の判定: `forkIds.mjs` の `readForkIdentity`(project.md の `fork_id:`。宣言なし・形違い・祖先と同名は未検証 = exit 2)。自分の名前が `src/lib/CATALOG.md` の先頭の節の見出しなら Tier1 で対象外。remote の有無・origin の URL では決めない(親の remote を設定し忘れた fork が黙って合格にならないように)
  2. 親の remote: `--parent` > 環境変数 `FORK_OWNERSHIP_PARENT` > origin 以外の remote が 1 つならそれ(`/flux` の「upstream の特定」と同じ)。ブランチ = `git ls-remote --symref <remote> HEAD`(`--branch` で上書き)
  3. 鮮度(下の節)
  4. Tier1 の版(下の「多段の Tier」)を台帳からたどる
  5. 判定: `git diff --name-status -M <base> HEAD` を judge に、Tier1 の版に無いファイルの違反を `middle-tier`(合格・参考)に付け替え、自分の一時許可を checkPermits に当てる。受け口の一覧は基準側の版を、一時許可は HEAD の版を読む

## 持ち主を調べる(ownership:who)

ファイルの持ち主は git の分岐点で決まる(D137)ので、名前を見ても分からない。`pnpm ownership:who` はパスごとに、持ち主・できること・根拠を答える。読むだけ(リポのファイルは書かない。親の取得 `git fetch` は remote の ref だけを動かす)。

```sh
pnpm ownership:who <path...>          # フォルダは中のファイル(HEAD ∪ 基準)に広げて 1 ファイルずつ答える
pnpm ownership:who <path...> --json   # 機械向け(エージェント・集計)
pnpm ownership:who <path...> --no-fetch --parent=upstream --branch=main
```

- 判定の規則は持たない: 前提(名前・基準・受け口の一覧・鮮度・Tier1 の版)は `ownership:check` と同じ `resolveForkContext`、今の差分は同じ `judgeFork`(judge → 中間 Tier の付け替え → pick → 一時許可)、「足したら」の答えは同じ `judge` に仮の A を渡して出す(`check.mjs`)
- 持ち主(`owner.kind`)
  - `tier1` = Tier1 の版にある / `middle` = 基準にあるが Tier1 の版に無い(`owner.forkId` = その版を持つ、Tier1 に最も近い中間 Tier の `fork_id:`。台帳の鎖でたどれなければ基準の project.md の `fork_id:`)/ `fork` = 基準に無く HEAD にある(この fork が足した)/ `generated` = 受け口の一覧の generated の行に当たる(`owner.tier` に元の持ち主)/ `missing` = 基準にも HEAD にも無い
- できること(`allowed`、無ければ `none`)
  - `edit`: Tier1 の物は受け口の kind ごと(edit = 書き換え可 / region = fork の区画の中だけ / marker = 印より下だけ / append = 追記だけ / generated = 生成器で作り直す)。中間 Tier の物・fork の物は書き換え・削除・rename 可
  - `add`: 無いパス。judge が `added`(中間 Tier の lib なら `middle-tier`)なら可、違反の reason は `blocked` に出る(`ancestor-lib-add`・`core-add`・`gate-add`・`unit-clash` など)
  - `replace`: `<名前>.replace.ts(x)`(`<名前>.default` の隣も同じ名前)を名指しする add の行があり、足しても合格のとき。1 行スイッチを向け替える
  - `override`: `<対象>.override.ts`(cron のフォルダは `task.override.ts`)を名指しする行があり、足しても合格のとき。`src/config/**` のような広い edit の行では上書きの口があるとは言わない
  - `none` = 受け口が無い → `/order <直接の親>`(要るまでの間は一時許可、上の「一時許可」)。`blocked` に止まる理由(`outside-intake`・`debt` など)
- 根拠(`evidence`): 基準・Tier1 の版・HEAD にあるか / 当たった受け口の行(行番号・kind・glob・理由)/ 今の差分(`ownership:check` と同じ status・reason・合否、違反なら一時許可の行の下書き)/ 自分の一時許可の行(行番号・依頼の番号・状態)。冒頭に基準(remote・branch・merge-base)と Tier1 の版(台帳の鎖)
- Tier1 では「直接の fork から見たら」を答える(基準 = HEAD、受け口の一覧 = HEAD の版)。冒頭に「このリポ = Tier1: 自由に編集できる」
- 終了コード: 0 = 答えた / 2 = 未検証(`ownership:check` の「鮮度」と同じ条件。台帳に無い notice があるときも)・引数の誤り
- テスト: `who.test.mjs`(`pnpm test:fork-ownership`)

## CI

- CI は任意。必ず走るのは `/flux` の各区間の verify と手元のコマンド
- コマンドは CI でも動く: git の情報だけで判定する・親の場所を remote か環境変数で受け取る・対話しない・終了コードで結果を返す。CI で使いたい fork は自分で設定する(親を取得できる checkout にし、shallow にしない)

## 鮮度

検査のたびに直接の親を取得して基準を求める。次のときは「未検証」(終了コード 2)で、合格にしない。

- 親の remote が無い・決まらない、既定のブランチが分からない、取得(`git fetch`)できない
- shallow clone(基準を求められない)、merge-base が無い
- 基準に `intake.txt` が無い(この検査を含む版をまだ取り込んでいない)、書式の誤りがある
- 取り込み済み(基準の索引の行 ∪ 基準の本文)なのに自分の台帳(`.notices/applied/<名前>.md`)に記録の無い notice がある。fork を作った時点の索引の行とツリーの notice は継承済みとして除く(`/flux` と同じ求め方。本文が片付けられても索引の行で数える)。`/flux` で記録してから検査し直す
- lint の厳しさは手元の情報だけで決める(確かめられなければ今のパスでの判定)。この検査とは別

## 多段の Tier(D29・D34)

- 厳密に判定するのは **Tier1(`src/lib/CATALOG.md` の先頭の節 = next-starter)の物**だけ。Tier1 の版にあるファイルは今どおり(受け口の中だけ書き換え、削除・rename は違反)。無いファイル = 中間 Tier 以下の物(親の fork が足したもの)は、書き換え・削除・rename を合格(reason `middle-tier`、`--verbose` で参考の一覧)。祖先の lib への追加は、その lib が Tier1 の版にあるときだけ違反。`unit-clash`・`override-own`・`default-add`・`default-edit` は付け替えない(どの段でも止める)
- Tier1 の版の決め方: 自分の台帳の最後の `upstream:<sha>`(`/flux` が区間ごとの行に書く、取り込んだ上流の版)の版から、その版に `.notices/applied/` があれば、その版のリポの名前(その版の project.md の `fork_id:`)の台帳の最後の `upstream:` へ … と、`.notices/applied/` の無い版(Tier1)に着くまでたどる。段数に依らない
- 未検証(exit 2): 台帳に `upstream:` が無い・その sha が履歴に無い(squash・rebase)・途中の版に `fork_id:` か、その名前の台帳が無い・循環・10 段を超える。台帳の改名と `upstream:` 欄は同じ取り込みで入れ、多段では**上の段から順に**取り込む(中間 Tier の台帳が旧い名前のままだと下の段が止まる)
- override: Tier1 は override(`<対象>.override.ts`。cron は `src/app/api/cron/<name>/task.override.ts`)を出荷しない(`pnpm extensions:check` が検査、`scripts/extensions/README.md`「override」)ので、親の override は中間 Tier の物。下の Tier は消しても空(空白とコメントだけ = 不在と同じ)にしてもよい
- 多段にするのはファイルを足す型(setting のキーとセクション・extensions の項目・wiring と proxy の fork が足したファイル・featureGateRules・override・`.replace`・`src/app/_providers/ForkProviders.tsx`)だけで、並べ替えの仕組みは無い。中間 Tier の業務ドメイン・`_components`・route の扱いは運用に任せる
- `/flux` は下の Tier が中間 Tier の物を消した・書き換えた後の取り込みの衝突を、下の Tier の判断を保って解き、報告と台帳の `notes:` に残す(`.claude/skills/flux/SKILL.md`)
- 規則と実装の分担(D10): `.claude/rules/lineage.md` の祖先の節 = その祖先の下流への契約で、下の Tier は誤字も直さず `/order <その節の持ち主>`。中間 Tier が足したファイル(lineage.md の外) = 実装で、下の Tier が直せる。ただし親の `<名前>.default.<拡張子>` は除く(既定はそれを作ったリポの物。下の Tier は隣の印なしのファイルに重ねる)。書き換えは `default-edit` がどの段でも止める。中間 Tier の既定の削除・rename はまだ `middle-tier`(合格)で、止めるのは棚の議会の側

## 中間層の規則(lineage.mjs)

中間 Tier が下流へ渡す規則の置き場 `.claude/rules/lineage.md`(仕様 = その前置き)の検査。git に触れない純関数だけで、git を読むのは呼び手。

- 構造(`checkLineageStructure`): 前置き → `<!-- end preamble -->` → `## <fork_id>` の節を古い祖先から順(自分は在れば最後)、各節は `<!-- end <fork_id> -->` で閉じる。`downstream: none` のリポが自分の節を持つ = 失敗
- 打ち消し(`checkOverrides`): `overrides: <fork_id>.<key> = <value> | why: <理由>` は project.md(そのリポだけ)と自分の節(下流にも)に書く。名指せるのは祖先の節の `(default)` の鍵だけ。鍵が無い・`(default)` でない・同じ project.md か同じ節で同じ対象を 2 回 = 失敗。祖先の鍵と同じ名前の鍵が project.md に overrides の行なしである = 警告
- 接触(`touchedOverrides`): `/flux` が取り込む前後の lineage.md を比べ、自分の打ち消しが名指す鍵が変わったら止める(`.claude/skills/flux/lineage-touch.mjs`)
- `runCheck` の `lineage` 欄 = `{ checked, failures, warnings }`(lineage.md の無い版は `checked: false` で検査しない)。failures は違反と同じく exit 1、件数は reason `lineage`。祖先の部分が基準どおりかは受け口 `append .claude/rules/lineage.md` の判定が見る
- 書式(`formatProblems`): `pnpm test:core-rules` が全リポで同じ parser を使って見る(前置きの終わりの印・節の閉じ・節の中の鍵の重複)

## fork の名前の宣言

各リポの名前の唯一の読み手は `forkIds.mjs`(テスト: `pnpm test:fork-ids`)。名前を使うのは台帳・一時許可・`src/lib/CATALOG.md` の節の見出し・受信箱だけで、受け口のファイル名には使わない(D137。fork の物の見分けは git の分岐点)。名前は `/fork-init` が最初に聞いて作る(既定 = リポ名の小文字、既知の名前と重なれば止まる)。

- 自分の名前: `.claude/rules/project.md` の `fork_id: <名前>` の 1 行。全リポ(Tier1 も、Tier1 = `next-starter`)が書く。台帳 `.notices/applied/<名前>.md`・一時許可 `.fork-ownership/<名前>.permits.txt`・`src/lib/CATALOG.md` の節の見出しも同じ名前(`-` の印は廃止)
- 親(上の Tier)の名前: `.notices/applied/*.md` の台帳名から自動で集める(台帳は `/flux` が作り、子の fork にも受け継がれる)。fork が書くのは自分の `fork_id:` の 1 行だけ
- 使える形: 小文字・数字・ハイフン(台帳・一時許可のファイル名になるので `.` は不可)。宣言なし・2 行以上・不正な形・祖先と同名(Tier1 の名前を名乗る fork、CATALOG の途中の節の名前)は検査が止める(ownership:check は exit 2)
- 下流の有無: 同じ `project.md` の `fork_id:` と同じ節に `downstream: yes|none` の 1 行(yes = 下流の fork を持つ・持つ予定)。読み手は `forkIds.mjs` だけで、`/ship`・`/flux` の中継判定・`.claude/rules/lineage.md` の検査はこの値を使う。欠落・2 行以上・yes / none 以外・`fork_id:` と別の節は `downstreamError`(名前の誤りの `errors` とは別の欄)。止めるのは ownership:check(未検証 = exit 2)と lineage.md の検査だけで、`extensions:check`(`pnpm build`)は止めない。散文で下流を説明する行は別の鍵名(Tier1 は `downstream_users:`)
- API: `readForkIdentity(repoRoot)` → `{ own, ancestors, isTier1, downstream, downstreamError, errors }` / `readDeclaredForkIds(repoRoot)` → `{ own, inherited, all, errors }` / `parseForkIdDeclaration(text)` / `parseDownstreamDeclaration(text)`
- origin の URL から導く実装は持たない(D27)

## 点つきの名前の分類(dottedNames.mjs)

受け口のファイル名の点つきの形の唯一の分類: 印なし `<名前>` / 既定 `<名前>.default` / 丸ごと置き換え `<名前>.replace` / 一部の上書き `<対象>.override`(`<対象>` は `user.role` のように `.` を含んでよい)/ client の口 `<名前>.client` / テスト `.test`・`.spec`・`.d` / それ以外 = 旧い fork の名前の印。生成器・タスク・常時実行の例外・`src/wiring` の目録・screens の検査が使い、旧い印は止めて共有の棚の印の移行の notice を案内する(`oldMarkerProblem`)。

## folderCatalog との分担

- [`folderCatalog`](../folderCatalog/README.md): 目録(`CATALOG.md`)と実在のディレクトリの整合、lib 単位の所有(目録の節)による lint の厳しさ
- forkOwnership: 直接の親との差分から、受け口の外の書き換え・削除・祖先 lib への追加を見つける
