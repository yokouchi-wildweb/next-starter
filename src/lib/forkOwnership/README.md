# forkOwnership

fork が upstream(直接の親 Tier)のファイルを、決められた場所の外で書き換えていないかを調べる検査の仕様。

**fork にはまだ組み込んでいない(`/flux` の verify 等への配線は段階②の後半)。** 部品: 受け口の一覧(`intake.txt`)、判定の核(`judge.mjs`)、一時許可の照合(`permits.mjs`)、区画の読み取り(`regions.mjs`)は git に触れない純粋関数。git を扱うのは検査の本体(`check.mjs`)とコマンド(`cli.mjs`)だけ。決定の経緯と見送った案は [docs/journal/2026-10-29--next-starter--fork-ownership-decisions.md](../../../docs/journal/2026-10-29--next-starter--fork-ownership-decisions.md)。

## 目的

- 全ファイルの持ち主を書き出すことはしない。持ち主を知る必要がある場面(lint の厳しさ・削除と書き換えの検査・notice)ごとに、必要な範囲だけを決める
- 受け口の外を変える必要が出たら、まず直接の親へ改良を依頼する(`/order <親>`)。upstream の汎用化の不足を、依頼を通して直していく

## 判定

- 基準 = 直接の親 Tier から最後に取り込んだ版(`/flux` の base と同じ merge-base)。多段の Tier でも直接の親だけを見る
- 所有台帳は作らない。基準との git の比較(`git diff --name-status -M <基準> HEAD`)だけで決める
- fork が先に作り、後で親が同じパスに足したファイルは、取り込んだ時点で親の物(基準に入るので自然にそうなる)
- 判定の順(`judge.mjs`。reason ごとの合否は `REASONS`)
  1. A(fork が足した)→ `added`。ただし基準の `src/lib/<name>/` が実在する `<name>` の中なら `ancestor-lib-add`(違反。自分の lib に置いて re-export する)。祖先の lib かどうかは基準の git だけで決まるので、`folderCatalog` の目録は使わない
  2. D → `deleted`、R(元が基準にある)→ `renamed`。受け口の中でも違反(config の削除、`_` 付きへの rename も)
  3. M → 受け口の一覧で当たった kind ごと(下の表)。どれにも当たらなければ、生成器の区画の中だけの差なら `generator-region`(合格)、それ以外は `outside-intake`(違反)
- 生成器の区画(`AUTO-GENERATED-START/END`・`=== AUTO-GENERATED … START/END ===`・終わりの印の無い `// --- Auto-generated imports ---` = 続く import の行まで・道具が丸ごと書き足す `<!-- BEGIN:nextjs-agent-rules -->` 〜 END = 印の行と直前の空行ごと)は検査の対象外。生成器の印の統一は別の論点
- 区画の中身を除いたテキスト(`stripOwnedRegions`)が基準側と fork 側で同じ = 区画の中だけの書き換え。一時許可の指紋もこのテキストから取る

## 受け口の一覧

- `intake.txt` = fork が書き換えてよい場所の一覧。upstream が持ち、検査は**取り込み済みの upstream 側の版**から読む(fork が一覧を広げて自分を許すことはできない)
- 書式: 1 行 1 規則 `<kind> <glob>  # 理由`(理由は必須)。`!<glob>` はそれまでに当たった規則を外す。最後に当たった規則が効く。glob は `node:path` の `matchesGlob`
- kind と、M(書き換え)の合否

  | kind | 合格 | 違反 |
  | --- | --- | --- |
  | edit | 何を書き換えても `intake` | — |
  | region | fork の区画(印の対)と生成器の区画の外が基準と同じ → `region` | 外も変えた `outside-region` / 印の対が壊れている `region-markers` |
  | marker | `fork entries below` の行までが基準と同じ → `marker` | `above-marker`(印が無い場合も) |
  | append | 基準の中身が先頭にそのまま残る → `append` | `not-append` |
  | generated | 生成物 → `generated` | — |
  | debt | — | `debt`(upstream の負債の箇所。一時許可で通す) |

- 載せている物: リポジトリ直下の 6 種(package.json・pnpm-lock.yaml・.gitignore・.env.example・next.config.ts・.mcp.json)と README.md・`eslint.config.fork.mjs`(下)/ ロゴ・favicon / `src/config/**`(config の再設計までは全体、値とキーを区別しない。Tier1 の config の規則はそのまま)/ `src/styles/*.css` / 1 行スイッチ(page.tsx・枠の layout.tsx)/ `_components/**` / `_layout/`・`_screen/` のドット区切り名のカスタム / cron の `override.ts` / `domainEntry.override.ts` / registry と room・seed の登録点(region)・デモの利用者の値・room の wrangler.toml / `.claude/rules` の PER_PROJECT と marker のファイル / `src/lib/CATALOG.md`(append)/ 生成物
- 一覧の鮮度: `pnpm test:fork-ownership` が書式と、各 glob の固定の部分(最初の `*` より前)が実在することを見る(fork だけが作るファイルは upstream に無いので、glob そのものの当たりは見ない)。fork が作るファイルを名指しする行は、理由に「upstream には無い」と書いて外す
- 外のままにした物と理由: `eslint.config.mjs`(fork の設定は `eslint.config.fork.mjs` に書く。upstream は空の配列で出荷し、`eslint.config.mjs` が最後に読み足す)/ `tsconfig.json`(paths の不足は upstream で直す。要るなら一時許可 + 依頼)/ `AGENTS.md`(ただし `next dev` が書き足す `<!-- BEGIN:nextjs-agent-rules -->` の区画は、印の行ごと生成器の区画として除く。Next の版で中身が変わるので upstream に固定で置けない)/ 既存の `eslint-rules/*.mjs` の書き換え(新しい規則のファイルは追加なので合格)
- 負債の行(debt): upstream 自身が core の中のファイルを下流の編集点として案内している箇所。fork 側には何も書かせず、upstream が負債として一覧に載せ、core の外に受け口を用意した notice で外す
  - 載せる基準: 案内が「core の中のこのファイルを fork が編集・差し替える」で、受け口(edit / region・fork が足すファイル・`src/config/**`)で済まない物。登録の API(`register*()`)を fork のファイルから呼べる物、fork が新しいファイルを足すだけの置き場は載せない
  - 理由の欄 = 案内の所在 → 受け口づくりの依頼の番号(`upreq:<id>`)。fork がその箇所を書き換えるときは、この番号を書いた一時許可で通す
  - 件数: Tier1 で `pnpm ownership:check` が「対象外 — upstream の負債の行 n」(`--verbose` でパスも)、`pnpm test:fork-ownership` が diagnostic で出す。`/inbox` の一覧の先頭にも出る
  - 負債の行が実在しないファイルを指す・依頼の番号が無いと `pnpm test:fork-ownership` が失敗する
- 中間 Tier の一覧にも「下流が消してよい」行は作らない。要らない物は持ち主が自分で消し、merge で流す
- API: `parseIntake(text)` → `{ rules, errors }` / `matchIntake(rules, path)` → 効く規則か `null` / `judge({ changes, baseText, headText, baseLibs, intake })` → `{ entries: [{ status, path, from, kind, reason, verdict }], counts }`

## 一時許可

受け口の外の書き換えを、直接の親への依頼が片付くまでの間だけ通す行。例外の置き場はこれ 1 つ(猶予の区画は作らない)。

- 対象
  - 受け口が無い固有の機能、upstream のバグ・性能・セキュリティの修正。既存の受け口で済む物には出さない(受け口へ移す)
  - upstream の負債の箇所(debt)。受け口ができた notice で外す
  - 削除・rename(D/R): 付ける依頼は「止める受け口(feature-gate 等)を用意してほしい」に限る。受け口ができたら、止めてから復元する
  - 祖先 lib への追加: 付ける依頼は「その lib に入れてほしい / 受け口がほしい」に限る(ふつうは自分の lib に置いて re-export する)
- 置き場: `.fork-ownership/<fork-id>.permits.txt`(fork-id = `.notices/applied/` と同じ所有者 ID)。fork が足すファイルなので fork の物。多段の Tier では親の許可ファイルも基準に入るが、読むのは自分の fork-id のファイルだけ(親の許可を子が借りない)
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

- 依頼の解決: 親が依頼を片付けて出荷するとき、notice の `resolves:` 欄に依頼の番号を書く(下流から来た依頼なら必ず。`.notices/README.md`「解決(resolves)」)。`pnpm ownership:check` は基準(取り込み済み)の `.notices/` と `done/` の `resolves:` を集め、すべての番号が解決した許可を expired-resolved にする。`/flux` は区間の計画で、流入する `resolves:` のうち自分の許可に当たる行を示す
- 却下: 元に戻す・受け口へ移す・別の方針で許可し直す、のどれかを必須にする。明示の期限は持たない(放置は `/flux`・`/wen` が毎回一覧に出す)
- 「修正だけ先に取り込む」手段は作らない
- API: `parsePermits(text)` → `{ permits, errors }` / `blobId(text)` / `fingerprint(text, kind)` / `checkPermits({ entries, permits, baseText, headText, intake, resolvedUpreqs })` → `{ entries(permit・verdict 付き), leftovers }` / `permitsPath(forkId)`

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
- 違反には、今の指紋で書いた**一時許可の行の下書き**が付く(指紋は区画の中身を除いた blob なので、素の `git hash-object` では出せない)。一時許可で片付けるときは、`<依頼の番号>` と `<理由>` を埋めて `.fork-ownership/<fork-id>.permits.txt` に貼り、commit してから検査し直す
- 手順(`check.mjs` の `runCheck`)
  1. 名前と Tier1 の判定: `forkIds.mjs` の `readForkIdentity`(project.md の `fork_id:`。宣言なし・形違い・祖先と同名は未検証 = exit 2)。自分の名前が `src/lib/CATALOG.md` の先頭の節の見出しなら Tier1 で対象外。remote の有無・origin の URL では決めない(親の remote を設定し忘れた fork が黙って合格にならないように)
  2. 親の remote: `--parent` > 環境変数 `FORK_OWNERSHIP_PARENT` > origin 以外の remote が 1 つならそれ(`/flux` の「upstream の特定」と同じ)。ブランチ = `git ls-remote --symref <remote> HEAD`(`--branch` で上書き)
  3. 鮮度(下の節)
  4. 判定: `git diff --name-status -M <base> HEAD` を judge に、自分の一時許可を checkPermits に当てる。受け口の一覧は基準側の版を、一時許可は HEAD の版を読む

## CI

- CI は任意。必ず走るのは `/flux` の各区間の verify と手元のコマンド
- コマンドは CI でも動く: git の情報だけで判定する・親の場所を remote か環境変数で受け取る・対話しない・終了コードで結果を返す。CI で使いたい fork は自分で設定する(親を取得できる checkout にし、shallow にしない)

## 鮮度

検査のたびに直接の親を取得して基準を求める。次のときは「未検証」(終了コード 2)で、合格にしない。

- 親の remote が無い・決まらない、既定のブランチが分からない、取得(`git fetch`)できない
- shallow clone(基準を求められない)、merge-base が無い
- 基準に `intake.txt` が無い(この検査を含む版をまだ取り込んでいない)、書式の誤りがある
- 取り込み済み(基準にある)なのに自分の台帳(`.notices/applied/<fork-id>.md`)に記録の無い notice がある。fork を作った時点のツリーにあった notice は継承済みとして除く(`/flux` と同じ求め方)。`/flux` で記録してから検査し直す
- lint の厳しさは手元の情報だけで決める(確かめられなければ今のパスでの判定)。この検査とは別

## fork ID の宣言

fork のドット名のファイル(`src/wiring/<名前>[.client].<fork ID>.ts(x)` 等)の検査が「どの fork ID を受けるか」を読む口。読み手は `forkIds.mjs`(テスト: `pnpm test:fork-ids`)。

- 自分の名前: `.claude/rules/project.md` の `fork_id: <名前>` の 1 行。全リポ(Tier1 も、Tier1 = `next-starter`)が書く。台帳 `.notices/applied/<名前>.md`・一時許可 `.fork-ownership/<名前>.permits.txt`・`src/lib/CATALOG.md` の節の見出しも同じ名前(`-` の印は廃止)
- 親(上の Tier)の ID: `.notices/applied/*.md` の台帳名から自動で集める(台帳は `/flux` が作り、子の fork にも受け継がれるので、孫の fork は親の fork のドット名のファイルも受けられる)。fork が書くのは自分の `fork_id:` の 1 行だけ
- 使える形: 小文字・数字・ハイフン(ドット名の区切りとぶつかるので `.` は不可)。宣言なし・2 行以上・不正な形・祖先と同名(Tier1 の名前を名乗る fork、CATALOG の途中の節の名前)は検査が止める(ownership:check は exit 2)
- API: `readForkIdentity(repoRoot)` → `{ own, ancestors, isTier1, errors }` / `readDeclaredForkIds(repoRoot)` → `{ own, inherited, all, errors }` / `parseForkIdDeclaration(text)` / `parseForkDotName(fileName, options)`
- 名前の読み手はこれ 1 つ(所有の検査・目録・ドット名の検査が使う)。origin の URL から導く実装は持たない(D27)

## folderCatalog との分担

- [`folderCatalog`](../folderCatalog/README.md): 目録(`CATALOG.md`)と実在のディレクトリの整合、lib 単位の所有(目録の節)による lint の厳しさ
- forkOwnership: 直接の親との差分から、受け口の外の書き換え・削除・祖先 lib への追加を見つける
