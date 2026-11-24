# forkOwnership

## Overview

- fork が upstream(直接の親 Tier)のファイルを、決められた場所(受け口)の外で書き換えていないかを調べる検査と、パスごとの持ち主を答える問い合わせ
- `/flux` が各区間のコミットの後・push の前に `pnpm workflow ownership check` を走らせる(`.claude/skills/flux/SKILL.md` 手順 7c)
- 全ファイルの持ち主を書き出すことはしない。持ち主を知る必要がある場面(lint の厳しさ・削除と書き換えの検査・notice)ごとに、必要な範囲だけを決める
- 受け口の外を変える必要が出たら、まず直接の親へ改良を依頼する(`/order <親>`)。upstream の汎用化の不足を、依頼を通して直していく
- 使う時・直す時の決まりは札 .claude/rules/items/lib/forkOwnership.md にある。この README は使い方と置き場の形

## Usage

### 検査(pnpm workflow ownership check)

```sh
pnpm workflow ownership check            # fork の中で。commit 済みの HEAD を見る(作業ツリーの未 commit は見ない)
pnpm workflow ownership check --json     # 機械向け(CI・集計)
pnpm workflow ownership check --verbose  # 合格したパスも並べる
pnpm workflow ownership check --parent=upstream --branch=main
```

- 終了コード: 0 = 合格(Tier1 は「親なし: 対象外」)/ 1 = 違反あり / 2 = 未検証・設定の不足(合格にしない。条件は Internals の「鮮度」)
- `/flux`: 基準に `intake.txt` がある区間は、区間を commit した後・push の前に走らせ、1 と 2 は停止条件(片付けを追加の commit で積み、0 になってから push する)
- 出力: 先頭に結論と基準(remote・branch・base)、reason ごとの件数、違反と一時許可の残骸・書式の誤りの一覧
- 違反には、今の指紋で書いた一時許可の行の下書きが付く。一時許可で片付けるときは、`<依頼の番号>` と `<理由>` を埋めて `.fork-ownership/<名前>.permits.txt` に貼り、commit してから検査し直す
- 一時許可の依頼の出し方は `/order`「一時許可の依頼」、依頼の状況は `/wen permits`、放置と project.md の食い違いは `/flux` の最終報告(上流への所見 (e)(f))に出る
- 判定の中身と手順: 下の Internals「判定」「検査の手順」

### 持ち主を調べる(pnpm workflow ownership who)

ファイルの持ち主は git の分岐点で決まるので、名前を見ても分からない。`pnpm workflow ownership who` はパスごとに、持ち主・できること・根拠・変え方の型を答える。読むだけ(リポのファイルは書かない。親の取得 `git fetch` は remote の ref だけを動かす)。

```sh
pnpm workflow ownership who <path...>          # フォルダは中のファイル(HEAD ∪ 基準)に広げて 1 ファイルずつ答える
pnpm workflow ownership who <path...> --json   # 機械向け(エージェント・集計)
pnpm workflow ownership who <path...> --no-fetch --parent=upstream --branch=main
pnpm workflow ownership who <path...> --base=<rev>   # その版を基準(親の版)にして答える(/flux が取り込む区間の merge 先を渡す、D313)
```

- 答えの欄(D312、/flux がファイルごとの扱いを引く 1 本の読み手): 持ち主(`owner`)・受け口の一覧の行の種類(`kind`: edit / add / region / marker / append / generated / debt / self、当たる行が無ければ null)・生成の作り手(`generated`: `{ generator, command, part, region }` = 生成器の名前(phase.json の置き場の名前、`pnpm generate domain` は `domain`)・作り直しの命令・ファイルの中の持ち分(phase.json の outputs の `part`。無い = ファイル丸ごと。part の行はファイルの行の種類を変えない: vercel.json は self のまま、generated に cron と crons)・受け口の一覧の region の行か。生成物でなければ null。種類とは別の欄)・読んだ版(答え全体の `read`: `{ base, head }` = 受け口の一覧・phase.json・木を読んだ版の sha と HEAD の sha)
- `--base=<rev>`: 基準を直接の親との merge-base(Tier1 は HEAD)からその版に替える。取り込みの途中の答えなので「取り込み済みの notice が台帳に無い」で止めない(所有の検査 check はこの口を持たない)。無い版 = 終了コード 2

- 前提(名前・基準・受け口の一覧・鮮度・Tier1 の版)と判定は `pnpm workflow ownership check` と同じ。「足したら」の答えは同じ `judge` に仮の A を渡して出す
- 持ち主(`owner.kind`): `tier1` = Tier1 の版にある / `middle` = 基準にあるが Tier1 の版に無い(`owner.forkId` = その版を持つ、Tier1 に最も近い中間 Tier の `repo_id`)/ `fork` = 基準に無く HEAD にある / `generated` = 受け口の一覧の generated の行に当たる(`owner.tier` に元の持ち主)/ `missing` = 基準にも HEAD にも無い
- できること(`allowed`、無ければ `none`)
  - `edit`: Tier1 の物は受け口の kind ごと(edit = 書き換え可 / region = fork の区画の中だけ / marker = 印より下だけ / append = 追記だけ / generated = 生成器で作り直す)。中間 Tier の物・fork の物は書き換え・削除・rename 可
  - `add`: 無いパス。judge が `added`(中間 Tier の lib なら `middle-tier`)なら可、違反の reason は `blocked` に出る
  - `replace`: `<名前>.replace.ts(x)` を名指しする add の行があり、足しても合格のとき
  - `override`: `<対象>.override.ts`(cron のフォルダは `task.override.ts`)を名指しする行があり、足しても合格のとき。`src/config/**` のような広い edit の行では上書きの口があるとは言わない
  - `none` = 受け口が無い → `/order <直接の親>`(要るまでの間は一時許可)
- 根拠(`evidence`): 基準・Tier1 の版・HEAD にあるか / 当たった受け口の行 / 今の差分(違反なら一時許可の行の下書き)/ 自分の一時許可の行。冒頭に基準と Tier1 の版(台帳の鎖)
- 型(`type`・`keys`・`write`・`source`): fork がこのパスを変えたいときにすること。判定の順は 下の Internals「型の答え」
- Tier1 では「直接の fork から見たら」を答える(基準 = HEAD、受け口の一覧 = HEAD の版)。冒頭に「このリポ = Tier1: 自由に編集できる」
- 終了コード: 0 = 答えた / 2 = 未検証・引数の誤り

### 取り込みで型 5 self を自分の版に戻す(pnpm workflow ownership selfKeep)

```sh
pnpm workflow ownership selfKeep --pre=<区間の前> --target=<区間の merge 先>          # 何をするかだけ出す(dry-run)
pnpm workflow ownership selfKeep --pre=<区間の前> --target=<区間の merge 先> --apply  # 書く(/flux は先端の版を tip.mjs で走らせる)
```

- 区間の merge の後(コミットの前)、区間の上流の差分(`git diff <前>...<先>`)に入った型 5 self のファイルを、衝突したかどうかによらず取り込みの前の版に戻す(D314: いつも自分の版を残す)
- 見るファイル = `SELF_FILES` と作業ツリーの受け口の一覧の self の行。取り込みの前に無かった物は、必ず持つ self(`SELF_REQUIRED`)なら親の版を最初の自分の版に、持たなくてよい self なら消す(自分の版 = 無い)
- パスごとに親の差分の命令を出す(区間で 1 度見せ、合う所だけ別の commit で手で写す)| 終了コード 0 / 2 = 未確認(rev が解けない)| 計画は `self.mjs` の `planSelfKeep`(純)

## API

入口は `./node` の 1 つ(`src/lib/forkOwnership/node.mjs`。閉じた lib: 下の名前は全部ここから読み、中のファイルは読まない)。読み手は Next の外のプログラム(scripts・lint・テスト・next.config・.notices の codemod)だけなので入口 `.` は置かない。CLI の本体 `runOwnershipCheckCli`(cli.mjs)・`runOwnershipWhoCli`(whoCli.mjs)も読み込んだだけでは走らず、`scripts/workflow/ownership/check.mjs`・`who.mjs` が呼ぶ。

### 受け口の一覧(`intake.mjs`)

- `parseIntake(text)` → `{ rules, errors }`
- `matchIntake(rules, path)` → 効く規則か `null`
- `replaceIntakeBlock(text, rows)` → 生成区画を入れ替えたテキスト

### 判定の核(`judge.mjs`)

- `judge({ changes, baseText, headText, baseLibs, baseHasCore, baseHasGate, intake, places, baseUnits })` → `{ entries: [{ status, path, from, kind, reason, verdict, clash }], counts }`
  - `places` = `unitPlaces(基準のファイル, 基準の中身)`、`baseUnits` = `unitIndex(基準のファイル)`。渡さなければ単位名の検査をしない
  - `clash` = unit-clash の相手の基準のパス
  - reason ごとの合否は `REASONS`
- `forkAddedFiles(repoRoot, { parent, branch, fetch })`: fork が足したファイルの一覧だけが要る検査(featureGate の規則の重なりなど)の口。Tier1 は git に触れず空、基準が求められなければ `unverified`(合格にしない)

### 一時許可(`permits.mjs`)

- `parsePermits(text)` → `{ permits, errors }`
- `blobId(text)` / `fingerprint(text, kind)`
- `checkPermits({ entries, permits, baseText, headText, intake, resolvedUpreqs })` → `{ entries(permit・verdict 付き), leftovers }`
- `permitsPath(forkId)`
- 依頼の番号の形: `<YYYYMMDD-HHMMSS>-<slug>`(`permits.mjs` の中の正規表現 `UPREQ_ID`。入口からは出していない)

### 区画(`regions.mjs`、Node 組み込みだけの `.mjs`)

- `parseForkRegions(text)` → `{ regions: [{ start, end, legacy }], errors: [{ line, message }] }`(行は 1 始まり、start / end は印の行)
- `isInForkRegion(regions, line)`: その行が区画の中(印の行を除く)か
- `FORK_REGION_START` / `FORK_REGION_END` / `LEGACY_FORK_MARKERS`
- 生成器の区画: `parseGeneratorRegions(text)` / `stripOwnedRegions(text, { fork })`

### 基準の版のファイル(`baseFiles.mjs`)

- `readBaseFiles` / `lastUpstreamSha`: notice の隣の codemod `.notices/<id>.<名前>.mjs` が入口 `./node` から読む

### リポの名前と段(`forkIds.mjs`)

- `readForkIdentity(repoRoot)` → `{ own, ancestors, isTier1, tier, downstream, downstreamError, errors }`
- `readDeclaredForkIds(repoRoot)` → `{ own, inherited, all, errors }`
- `parseRepoJson(text)` / `parseRepoIdentity(text)` / `formatRepoJson(values)`
- `forkIdOfTexts({ repoJson, projectMd })`: 過去の版を読む所(repo.json を先に、無ければ古い形)
- 古い形: `parseForkIdDeclaration(text)` / `parseDownstreamDeclaration(text)`

### 中間層の規則(`lineage.mjs`)

- `checkLineageStructure` / `formatProblems`(中身は Internals の「中間層の規則」)

### 検査の本体(`check.mjs`)

- `runCheck`: `pnpm workflow ownership check` の手順(Internals の「検査の手順」)。`lineage` 欄 = `{ checked, failures, warnings }`
- `resolveForkContext` / `judgeFork`: `pnpm workflow ownership who` も使う前提と判定

## Extension

### 受け口の一覧(intake.txt)

- `intake.txt` = fork が書き換えてよい場所の一覧。upstream が持ち、検査は取り込み済みの upstream 側の版から読む
- 書式: 1 行 1 規則 `<kind> <glob>  # 理由`。`!<glob>` はそれまでに当たった規則を外す。最後に当たった規則が効く。glob は `node:path` の `matchesGlob`
- kind と、M(書き換え)の合否

  | kind | 合格 | 違反 |
  | --- | --- | --- |
  | edit | 何を書き換えても `intake` | — |
  | add | — (足すのは A なので `added`) | 基準にあるファイルの書き換え `outside-intake` |
  | region | fork の区画(印の対)と生成器の区画の外が基準と同じ → `region` | 外も変えた `outside-region` / 印の対が壊れている `region-markers` |
  | marker | `fork entries below` の行までが基準と同じ → `marker` | `above-marker`(印が無い場合も) |
  | append | 基準の中身が先頭にそのまま残る → `append` | `not-append` |
  | append(`*.json`) | 鍵を足すだけ: 基準の鍵を全部持ち、値が同じ(オブジェクトの下は再帰、配列と値はそのまま同じ。鍵の順は問わない)→ `append`。例外は `judge.mjs` の `JSON_FREE_KEYS`(D304): `package.json` の `name` と、`dependencies`・`devDependencies`・`optionalDependencies`・`peerDependencies` の上流の依存の版の範囲(鍵は残す) | 上流の鍵を消した・上流の値を変えた `json-upstream-key`(違った鍵の道を出す)/ JSON として読めない `json-unparsed` |
  | generated | 生成物 → `generated` | — |
  | debt | — | `debt`(upstream の負債の箇所。一時許可で通す) |
  | self | 書き換え → `self` | — |

- self(型 5: 各リポが自分の版を持つ): `.claude/rules/project.md`・`.claude/rules/behavior.md`・`.claude/rules/shortcuts.md`(合言葉、D311)・`repo.json`・直下のコードの設定 3 本(`next.config.ts`・`eslint.config.mjs`・`playwright.config.ts`)・`vercel.json`・`backend-selection.json` の 9 行だけ、1 ファイル 1 行・ぴったりのパス。設定 3 本は Tier1 の本体 `<道具>.config.core.<拡張子>`(上流、行なし)を読み、足す・包む・外す(playwright は読まなくてよい。D299)。Tier1 の版は本体をそのまま使う。`backend-selection.json`(バックエンドの選択表: 口 → 実装の名前)は必ず持つ(書くのは `pnpm workflow backend-selection fill` / `set`、Tier1 の版は `{}`)。`vercel.json` は持たなくてよい(Vercel にデプロイするリポだけが持つ。crons は `pnpm generate cron` の出力、他の鍵は手書き、D295)。`pnpm workflow ownership who` は型 5 と答える。中身は見ず、`pnpm workflow ownership check` が 3 つだけで落とす(既定で入、`--no-self` で外す): 必ず持つ 8 つのファイルが無い・self の行が 9 行ちょうどでない・Tier1 でないリポの project.md が直接の親の版と同じまま。親の版をそのまま使うのは正式な選び方で、取り込みの前から親の版のままなら何も言わない。取り込みの merge で自分の行が消えて親の版と同じになったファイル(merge の前の版が、その前に取り込んだ親の版 = merge の前と基準の分岐点の版と違っていた)は `self.asks` の `self-parent-lost` に出し(合否は変えない)、`/flux` が「親の版に従う / 自分の行を戻す」を人に聞く
- 載せている物(手書き = src の外だけ): リポジトリ直下は 3 つの形(D304) = JSON は鍵を足すだけ(`append`: package.json・.mcp.json・firebase.json。マシンごとの MCP の指定は `~/.claude.json`)/ 行のファイルは印の行 `# fork entries below (upstream never edits below this line)` より下(`marker`: .gitignore・.env.example)(コードの設定 3 本は上の self)/ ロゴ(public/)/ room の登録点(region)と wrangler.toml / `.claude/rules` の PER_PROJECT・lineage.md(append)/ 負債(debt)。src の下の行と生成物の行は全部生成区画(Internals の「受け口の一覧の生成区画」。`pnpm-lock.yaml` も生成器 lockfile の宣言から `generated`、作り直しは `pnpm generate lockfile` = `pnpm install`)
- 外のままにした物と理由: `README.md`(上流だけ: 全リポ共通の入口の文書)/ コードの設定の本体 `next.config.core.ts`・`eslint.config.core.mjs`・`playwright.config.core.ts`(上流だけ。各リポは素の名前の自分の版で読む)/ `tsconfig.json`(paths の不足は upstream で直す。要るなら一時許可 + 依頼)/ `AGENTS.md`(`next dev` が書き足す `<!-- BEGIN:nextjs-agent-rules -->` の区画は生成器の区画として除く)/ 既存の `eslint-rules/*.mjs` の書き換え(新しい規則のファイルは追加なので合格)
- 負債の行(debt): upstream 自身が core の中のファイルを下流の編集点として案内している箇所。理由の欄 = 案内の所在 → 受け口づくりの依頼の番号(`upreq:<id>`)。件数は Tier1 で `pnpm workflow ownership check` が「対象外 — upstream の負債の行 n」(`--verbose` でパスも)、テストが diagnostic で出す。`/inbox` の一覧の先頭にも出る

### 一時許可(.fork-ownership/<名前>.permits.txt)

受け口の外の書き換えを、直接の親への依頼が片付くまでの間だけ通す行。

- 置き場: `.fork-ownership/<名前>.permits.txt`(名前 = 自分の `repo_id`。`.notices/applied/` の台帳名と同じ)。fork が足すファイルなので fork の物。読むのは自分の fork-id のファイルだけ
- 書式: 1 ファイル 1 行
  ```
  <path> upreq:<id>[,<id>…] base:<指紋|-> head:<指紋|->  # 理由
  ```
  - upreq = 受信箱の指令 id(`<YYYYMMDD-HHMMSS>-<slug>`)を 1 つ以上
  - `-` = そのファイルが無い: D/R の head、祖先 lib への追加の base。R は移動元のパスに書く
- 状態(valid / refresh / expired-base / expired-resolved / 残骸)と指紋の取り方: Internals の「一時許可の照合」

### registry の fork の区画

- `src/registry/` と、受け口の一覧で region にしたファイル(`servers/room/src/registry.ts`。シードは各ドメインの `seed.ts` で登録点を持たない)の中で fork が書いてよいのは、次の印の対の間だけ。印の外は upstream の物
  ```ts
  // --- fork entries start (upstream never edits inside) ---
  // --- fork entries end ---
  ```
- 1 ファイルに複数の対を置ける。fork の登録は import を伴うので、import 文の後にも対を置く
- 文言は行のファイルの marker(`fork entries below (upstream never edits below this line)`、.gitignore・.env.example)と語を揃えている
- 生成器の区画(`AUTO-GENERATED` 系)は fork の区画ではない
- 古い下流の印 3 通り(`// --- DOWNSTREAM (downstream で追加) ---` / `// --- ここに…（上流は空。下流が追記） ---` / `// --- FORK (手書き) ---`)は、`regions.mjs` が移行のために読める(終わりは字下げの浅い閉じ括弧)

### リポの名前と段(repo.json)

- 置き場: リポ直下の `repo.json`(機械用の値のファイル)。入れ子(D312): 一番上 = `repo_id`・`tier`(身元)、組 `agent`(方針、入口の命令は中の組 `entries`)・組 `vercel`。1 鍵 1 行、値は文字列か真偽値だけ(配列・数・深い組は誤り)。どのリポも自分の版を持つ(受け口の一覧に `self repo.json`)
  ```json
  {
    "repo_id": "next-starter",
    "tier": "root",
    "agent": {
      "server": "auto"
    },
    "vercel": {
      "plan": "pro"
    }
  }
  ```
- 読み手 `parseRepoJson` は入れ子だけを読み、呼び手へは点の道の表(`agent.server`・`agent.entries.deploy`・`vercel.plan`)で返す。平らな形(一番上の点の入った鍵、古い repo.json)は errors に `pnpm workflow repo-json migrate` の案内を出し、身元だけ読む(`flat` に鍵を並べる。過去の版の名前を読む `forkIdOfTexts` は平らな形の誤りを数えない)
- `repo_id` = 自分の名前。全リポ(Tier1 = `next-starter`)が書く。台帳 `.notices/applied/<名前>.md`・一時許可 `.fork-ownership/<名前>.permits.txt`・`src/lib/CATALOG.md` の節の見出し・受信箱も同じ名前。使える形: 小文字・数字・ハイフン(ファイル名になるので `.` は不可)。名前は `/fork-init` が最初に聞いて作る(既定 = リポ名の小文字、既知の名前と重なれば止まる)
- `tier` = `root`(Tier1)| `middle`(下流の fork を持つ・持つ予定)| `leaf`(末端)。無い = `leaf`。下流の有無はここから導く(root・middle = yes、leaf = none)。`/sluice`・`/flux` の中継判定・`.claude/rules/lineage.md` の検査はこの値を使う
  - 見張り: `root` ⇔ 自分の名前が `src/lib/CATALOG.md` の先頭の節(両向き)。食い違い・知らない値は `downstreamError`。止めるのは pnpm workflow ownership check(未検証 = exit 2)と lineage.md の検査だけで、`pnpm check extensions`(`pnpm build`)は止めない
- `agent.<種類>`・`agent.entries.<種類>` = エージェントに任せる方針と危険な 3 つの入口の鍵(読むのは devcheck)。ほかの鍵は `errors`
- `vercel.plan` = Vercel の契約のプラン(`hobby` | `pro`、読むのは `readVercelPlan`、使うのは `pnpm generate cron` の `--plan` の無い時)。無い = Vercel にデプロイしないリポ(crons を作り直さない)。知らない値は `errors`
- 親(上の Tier)の名前: `.notices/applied/*.md` の台帳名から自動で集める(台帳は `/flux` が作り、子の fork にも受け継がれる)
- 書く命令: `pnpm workflow repo-json set <鍵> <値>`(と `/fork-init`)。古い形(`.claude/rules/project.md` の `fork_id:` / `downstream:` の行)からの移しは `pnpm workflow repo-json migrate`(`scripts/workflow/repo-json/README.md`)。古い形を読むのは過去の版を読む所(多段の台帳の鎖・`ownership who` の中間 Tier・safe point の親の名前)と移しの命令だけ

## Internals

### 部品の分け方

- git に触れない純粋関数: 受け口の一覧(`intake.mjs`)・判定の核(`judge.mjs`)・単位名(`unitNames.mjs`)・一時許可の照合(`permits.mjs`)・区画の読み取り(`regions.mjs`)・中間層の規則(`lineage.mjs`)
- git を扱う物: 検査の本体(`check.mjs`)とコマンド(`cli.mjs`)・持ち主の問い合わせ(`who.mjs`・`whoCli.mjs`)・基準の版のファイル一覧(`baseFiles.mjs`)
- 拡張点の宣言の読み手 `declarations.mjs` と点つきの名前の分類 `dottedNames.mjs` は地区の地図の側 `src/lib/districtMap/` にある。ここの同名の 2 つは再 export だけ。lib の import は forkOwnership → districtMap の一方向

### 判定

- 基準 = 直接の親 Tier から最後に取り込んだ版(`/flux` の base と同じ merge-base)。その上で、Tier1 の版にあるファイルだけを厳密に判定する(下の「多段の Tier」)
- 所有台帳は作らない。基準との git の比較(`git diff --name-status -M <基準> HEAD`)だけで決める。fork の物 = 基準に無く fork が足したファイル
- fork が先に作り、後で親が同じパスに足したファイルは、取り込んだ時点で親の物(基準に入るので自然にそうなる)
- 判定の順(`judge.mjs`)
  1. A(fork が足した)→ `added`。ただし次は違反(上から順に)
     - 上流の単位のフォルダの中 → `inside-unit-add`。単位 = 部品の棚(基準の `src/components/<分類>`・`src/hooks`・`src/utils`・`src/lib`)の直下の項目(ファイルかフォルダ)で、基準でフォルダの単位(`src/components/<分類>/<単位>/`・祖先の lib `src/lib/<name>/` など)の中に足したファイルが当たる。自分の単位・自分の lib に置く(lib なら re-export)。上流の物かどうかは基準の git だけで決まるので、`folderCatalog` の目録は使わない
     - 分類の直下の新しい単位(ファイルかフォルダ)・`src/hooks`・`src/utils` の新しいファイル・新しい `src/lib/<name>/`・fork の分類・分類の外の `src/components` 直下は `added`
     - 基準に `src/domains/core/` があり、足したパスがその中で受け口(`intake.txt` の debt 以外の行)に当たらない → `core-add`(fork のドメインは `src/domains/<x>/`、画面の部品は route の `_components/`)
     - 基準に `src/featureGate/`(門番)があり、足したパスがその中で受け口に当たらない → `gate-add`(足せるのは `rules/`・`required/` の `<名前>.ts`)
     - 基準に `.claude/rules/core/` があり、足したパスがその中 → `rules-core-add`(自分の決まりは `.claude/rules/` の `core/` の外に印なしの名前で、自分の品目の札は `.claude/rules/items/`。受け口の行は効かない)
     - 検査する場所への追加で、単位名が基準のファイルと同じ → `unit-clash`(`x.ts` と `x.tsx`、ファイルとフォルダの組。部品の棚では直下の項目の名前で比べる。別の名前にするか、丸ごと置き換えは `<名前>.replace`)。見つけて知らせるだけで、足すのを前もって止める仕組みは無い
     - `<対象>.override.ts(x)` で、対象が基準に無い → `override-own`(fork が自分で足した項目への override。中間 Tier の項目は下の Tier の基準にあるので可)
     - `<名前>.default.<拡張子>` で、同じフォルダに基準のファイルがある → `default-add`(既定はそこを作ったリポの物。自分のフォルダの自分の既定は可、中間 Tier も自分のルートに出してよい)
     - src/app の印なしの `frame.ts` で、同じフォルダに基準のルート(page / layout / 枠の宣言)がある → `frame-plain`(移し替え `pnpm check extensions -- frames-move`)。src/app の `frame.override.ts` の相手は基準のルートで、ルートの無いフォルダなら `override-own`
  2. D → `deleted`、R(元が基準にある)→ `renamed`。受け口の中でも違反(config の削除、`_` 付きへの rename も)
  3. M → 基準の `<名前>.default.<拡張子>` の書き換えは `default-edit`(違反、受け口の行より先に見る)。それ以外は受け口の一覧で当たった kind ごと(README「受け口の一覧」の表)。どれにも当たらなければ、生成器の区画の中だけの差なら `generator-region`(合格)、それ以外は `outside-intake`(違反)
- 生成器の区画(`AUTO-GENERATED-START/END`・`=== AUTO-GENERATED … START/END ===`・終わりの印の無い `// --- Auto-generated imports ---` = 続く import の行まで・道具が丸ごと書き足す `<!-- BEGIN:nextjs-agent-rules -->` 〜 END = 印の行と直前の空行ごと)は検査の対象外。`#` でコメントを書くファイルの対 `# === AUTO-GENERATED <name> START/END ===` も生成器の区画
- 区画の中身を除いたテキスト(`stripOwnedRegions`)が基準側と fork 側で同じ = 区画の中だけの書き換え。一時許可の指紋もこのテキストから取る

### 単位名

単位名 = パスから最後の拡張子と末尾の `/index` を除いた名前(`.replace` / `.override` は名前に残す)。

- 検査する場所(これだけ)
  - 部品の棚: 基準の `src/components/<分類>`(基準にファイルのある分類だけ)・`src/hooks`・`src/utils`・`src/lib`。直下の項目が単位(直下のファイルは最後の拡張子と `/index` を除いた名前、入れ子のパスは直下のフォルダの名前)。基準の単位のフォルダの中への追加は `inside-unit-add`
  - 直下の項目だけ: 基準の `src/**/extensionPoints.ts` の受け口のフォルダ(宣言は `src/lib/districtMap/declarations.mjs` で読む、`dir: "."` = 持ち主の直下)・`src/wiring`・`scripts`(門番の `rules`・`required` も宣言の受け口)
  - その下全部: route の隣(`src/app/**/_layout`・`_screen`・`_components`)
- `unit-clash`・`override-own`・`default-add`・`default-edit`・`frame-plain` は持ち主によらず止める(多段で `middle-tier` に付け替えない)

### 受け口の一覧の生成区画

- 受け口の行(生成区画 `# === AUTO-GENERATED intake START ===` 〜 `END`)は `pnpm generate extensions` が書き、ずれは `pnpm check extensions` が止める(`scripts/structure/extensions/README.md`「受け口の一覧の生成区画」)。src の下の行は全部ここで、出どころは 4 つの型:
  - 画面の差し替え(型 1): ルートの `page.tsx`(ルートの地図と同じ見つけ方、上流のルートごと)・枠の 1 行スイッチの `layout.tsx` = `edit` / 1 行スイッチ(src の下の `<名前>.default` の隣の素の名前 = `edit`、`<名前>.replace` = `add`。ちょうど 1 つの点の上流の項目のスイッチ(例 `src/domains/core/auth/plugs/frameSession/session.ts`)もこれ)/ `_layout`・`_screen` の隣の `*.replace` と下のリポの枠の宣言 `frame.override.ts` = `add`
  - 受け口と上書き(型 2・3): 宣言の受け口のフォルダ(`<dir>/*.{ts,tsx}` とフォルダ形 `<dir>/*/**`)= `add` / 上書きの対象の点(宣言の `overrides`)の隣の `.override.ts`(cron の `task.override.ts`・`domainEntry.override.ts`・ロール / core ロール / プロフィール)= `edit`、`addable` の対象(ロール・プロフィールの JSON)= `add`
  - 置き場(型 4): 持ち主の `extensionPoints.ts` の placement の点 = `src/config/**`(src/lib/districtMap)・`src/styles/*.css`(src/styles/core)・`src/business/**`(src/lib/business)・`src/app/favicon.ico`(src/app/_layout)・`src/app/**/_components/**`(src/lib/screens)= `edit`、`src/lib/CATALOG.md`(src/lib/folderCatalog)= `append`
  - 生成物と区画: 生成器の `phase.json` の `outputs` = `generated`(registries・`src/wiring/dbAgent.ts`・地区の地図・ルートの地図・mail の色・profiles の entities・`src/**/extensions/**`)、`regions` = `region`(`src/registry/**/*.ts`)。区画の最後に並ぶ(同じファイルなら生成物が効く)
- 種類は手書きだったときと同じ(`scripts/structure/extensions/intakeFromDeclarations.test.mjs`。生成器の雛形 `src/app/admin/_template/**/page.tsx` はルートでないので行が無い)
- ドメインのタスク・移行は受け口の行を持たない(fork は自分のドメインの `scripts/{tasks,migrations}/` に置く = fork が足したファイル。core のドメインの下に足すのは違反)
- 区画は生成器の区画なので、fork が自分の受け口の行を足して作り直しても合格(検査は基準の区画を読む)
- 既知の穴: フォルダ形の行は上流のフォルダ項目の中への fork のファイル追加も通す(第 2 段の棚の検査へ)
- 一覧の鮮度: テストが書式と、各 glob の固定の部分(最初の `*` より前)が実在することを見る(fork だけが作るファイルは upstream に無いので、glob そのものの当たりは見ない)。生成区画の行は見ない(項目 0 の受け口はフォルダが無い)

### 一時許可の照合(`checkPermits`)

| 状態 | 条件 | 合否 |
| --- | --- | --- |
| valid | 両方の指紋が今と同じ、解決していない依頼が残る | 合格(`permitted`) |
| refresh | fork 側の指紋が違う(許可の後に書き換えた) | 失敗(中身を見て許可し直す) |
| expired-base | 基準側の指紋が違う(親がそのファイルに触った) | 失敗(取り込んだ親の版で見直す) |
| expired-resolved | すべての依頼が解決済み | 失敗(親の受け口へ移す・元に戻す) |
| same-as-base(残骸) | 基準と同じに戻った | 失敗(行を消す) |
| unused(残骸) | 違反の無いファイルの行 | 失敗(行を消す) |

- 指紋 = 区画の中身を除いたテキストの git blob id(`git hash-object --stdin` と同じ値)。kind が region のファイルは fork の区画と生成器の区画を、他は生成器の区画だけを除く。区画の中の書き換えでは許可し直しにならない
- 依頼の解決: 基準(取り込み済み)の履歴で `.notices/` に足された notice の本文の最後の版(木に有ればその版、消えていれば消す前の版)の `resolves:` を集め(親が本文を片付けても失効は変わらない)、すべての番号が解決した許可を expired-resolved にする
- 検査が見るのは依頼の番号の形だけ(`UPREQ_ID`)で、どの受信箱の指令かは見ない。自分宛ての指令は親の notice の `resolves:` に載らないので、fork が自分で行を消すまで残る(親がファイルに触れば expired-base)

### 緊急修正の pick

親の緊急修正・先に取れる修正(`pick: clean`)を cherry-pick しても基準は動かないので、受け口の外のファイルはそのままだと違反になる。台帳の `picked:<sha>` がこれを通す。

- 台帳の行: `upstream:` は今の merge-base のまま(進めると Tier1 の版の判定がずれる)、`picked:` に pick の元の commit を書く(`.notices/README.md`「緊急修正(hotfix)」)
- 判定: 基準に pick を順に当てた中身と HEAD の中身が同じファイル、または pick がそのファイルを変えていて HEAD の中身が上流(親の ref と pick の元の commit)の履歴のそのパスのどれかの版とファイルごと同じファイル(fork が触っていない上流のファイルを緊急修正の版に置き換えた形: `hotfixApply`)を `picked`(合格)にする。fork が更に変えた・fork の編集が元からある・元の commit が取得できないときは違反のまま
- 既に基準に入った pick は対象から外れる(merge の後は差分に出ない)

### 検査の手順(`check.mjs` の `runCheck`)

1. 名前と Tier1 の判定: `forkIds.mjs` の `readForkIdentity`(repo.json の `repo_id`。宣言なし・形違い・祖先と同名は未検証 = exit 2)。自分の名前が `src/lib/CATALOG.md` の先頭の節の見出しなら Tier1 で対象外。remote の有無・origin の URL では決めない(親の remote を設定し忘れた fork が黙って合格にならないように)
2. 親の remote: `--parent` > 環境変数 `FORK_OWNERSHIP_PARENT` > origin 以外の remote が 1 つならそれ(`/flux` の「FINDING THE UPSTREAM」と同じ)。ブランチ = `git ls-remote --symref <remote> HEAD`(`--branch` で上書き)
3. 鮮度(下)
4. Tier1 の版(下の「多段の Tier」)を台帳からたどる
5. 判定: `git diff --name-status -M <base> HEAD` を judge に、Tier1 の版に無いファイルの違反を `middle-tier`(合格・参考)に付け替え、自分の一時許可を checkPermits に当てる。受け口の一覧は基準側の版を、一時許可は HEAD の版を読む

### 鮮度

検査のたびに直接の親を取得して基準を求める。次のときは「未検証」(終了コード 2)。

- 親の remote が無い・決まらない、既定のブランチが分からない、取得(`git fetch`)できない
- shallow clone(基準を求められない)、merge-base が無い
- 基準に `intake.txt` が無い(この検査を含む版をまだ取り込んでいない)、書式の誤りがある
- 取り込み済み(基準の履歴で `.notices/` に足された本文 ∪ 基準の木の本文。merge で足した物も拾い、改名の前の名前は除く = `/flux` の incoming.mjs と同じ)なのに自分の台帳(`.notices/applied/<名前>.md`)に記録の無い notice がある。fork を作った時点の履歴とツリーの notice は継承済みとして除く
- lint の厳しさは手元の情報だけで決める(確かめられなければ今のパスでの判定)。この検査とは別

### 多段の Tier

- 厳密に判定するのは Tier1(`src/lib/CATALOG.md` の先頭の節 = next-starter)の物だけ。Tier1 の版にあるファイルは受け口の中だけ書き換え、削除・rename は違反。無いファイル = 中間 Tier 以下の物は、書き換え・削除・rename を合格(reason `middle-tier`、`--verbose` で参考の一覧)
- 上流の単位の中への追加(`inside-unit-add`、祖先の lib も)は、その単位のフォルダが Tier1 の版にあるときだけ違反(無ければ中間 Tier の単位で `middle-tier`)
- `.claude/rules/service/` の下は中間 Tier が足した物も付け替えない
- Tier1 の版の決め方: 自分の台帳の最後の `upstream:<sha>` の版から、その版に `.notices/applied/` があれば、その版のリポの名前(その版の repo.json の `repo_id`、古い版は project.md の `fork_id:`)の台帳の最後の `upstream:` へ … と、`.notices/applied/` の無い版(Tier1)に着くまでたどる。段数に依らない
- 未検証(exit 2): 台帳に `upstream:` が無い・その sha が履歴に無い(squash・rebase)・途中の版に名前か、その名前の台帳が無い・循環・10 段を超える
- override: Tier1 は override を出荷しない(`pnpm check extensions` が検査)ので、親の override は中間 Tier の物。下の Tier は消しても空(空白とコメントだけ = 不在と同じ)にしてもよい
- 多段にするのはファイルを足す型(setting のキーとセクション・extensions の項目・wiring と proxy の fork が足したファイル・featureGateRules・override・`.replace`・fork の Provider(根の枠の点 rootProviders の項目))だけで、並べ替えの仕組みは無い
- `/flux` は下の Tier が中間 Tier の物を消した・書き換えた後の取り込みの衝突を、下の Tier の判断を保って解き、報告と台帳の `notes:` に残す
- 中間 Tier の既定の削除・rename はまだ `middle-tier`(合格)

### 中間層の規則(lineage.mjs)

`.claude/rules/lineage.md`(仕様 = その前置き)の検査。git に触れない純関数だけで、git を読むのは呼び手。

- 構造(`checkLineageStructure`): 前置き → `<!-- end preamble -->` → `## <fork_id>` の節を古い祖先から順(自分は在れば最後)、各節は `<!-- end <fork_id> -->` で閉じる。`tier` leaf のリポが自分の節を持つ = 失敗
- 鍵: 節の中の `- <key>: ...` の行。下の段が祖先の鍵を変えるのは、自分の文脈に同じ鍵を `(priority)` 付きで書くこと(`.claude/rules/core/design.md` priority)。読み方の決まりなので検査はしない
- `runCheck` の `lineage` 欄の failures は違反と同じく exit 1、件数は reason `lineage`。lineage.md の無い版は `checked: false`。祖先の部分が基準どおりかは受け口 `append .claude/rules/lineage.md` の判定が見る
- 書式(`formatProblems`): `pnpm check rules` が全リポで同じ parser を使って見る(前置きの終わりの印・節の閉じ・節の中の鍵の重複)

### 型の答え(`explain.mjs`)

`pnpm workflow ownership who` の答えに `type`・`keys`・`write`・`source`・`generated`(と `how`、none のとき `order`)を加える。判定に使う木は持ち主と同じ(Tier1 は HEAD、fork は直接の親との基準)で、読むのは宣言(`extensionPoints.ts`)・地区の見つけ方・ルート・名前の決まり(`src/lib/districtMap/extensionNames.mjs`)・受け口の一覧の kind・生成器の `phase.json`・`pnpm generate domain` の出力の種類(`scripts/structure/domain/phase.json` の `outputs`)。受け口の一覧の行の注記の文言は読まない。ownership check の合否は変えない(答えは案内)。

- 判定の順: generated → own → 1 → 2 / 3 → 4 → none(足してよい新しいパスは own)
  - `generated`: 受け口の一覧の generated / region の行(`source` = `pnpm generate <名前>`)、または `pnpm generate domain` が毎回書くファイル(`generate: false` のドメインを除く。`write` = 直す元: `domain.json`・`wrappers/`・受け口。最後の手段は `"generate": false`)。own より先に見る
  - `own`: この fork が足した物・中間 Tier の物(`write` = そのパス)。`pnpm generate domain` が無いときだけ書くファイル(`<domain>Service.ts`・`seed.ts`・管理画面の `page.tsx` など)と `generate: false` のドメインは、ほかの型に当たらなければ持ち主で own か none
  - `1` 丸ごと置き換え: `<名前>.default.ts(x)` とその隣の素の名前 → `write` = `<名前>.replace.<拡張子>`、`source` = スイッチ
    - 画面の `page.tsx` とその `_screen/**` の部品 → `write` = `<ルート>/_components/`、`source` = `page.tsx`
    - 枠の 1 行スイッチの `layout.tsx` とその `_layout/**` の部品 → `write` = 既定の隣の `<ルート>/_layout/<Layout>.replace.tsx`(`<Layout>` = `layout.tsx` の向け先の名前。向け先が既に `.replace` でも同じファイル。fork の枠の部品はルートの `_components/` に印なしの名前)、`source` = `layout.tsx`
  - `2` 重ね: 上書きの対象の点(ロール・プロフィール・cron の `task.ts`・`domainEntry.ts`。対象の glob が `<置き場>/*/<決まった名前>` = 1 フォルダ 1 単位の点(cron)だけ、そのフォルダのどのファイルも対象へ。`domainEntry.ts` の隣の `userService.ts` などは対象にしない)と、`overrideOf` を持つ受け口の項目 → `write` = `<対象>.override.ts`、`keys` = 宣言の `overrideOf`。src/app のルートの `frame.ts`(無くても) → `frame.override.ts`(`keys` = layout・page、`source` = 作ったリポの `frame.ts`、無ければ空の基準)
  - `3` 足す: 受け口のフォルダ → `write` = そのパス(既にある項目なら `<フォルダ>/<名前>.ts`)
  - `4` 置き場: 地区の `config.ts` / `config.ui.ts` → `src/config/<種類>/<名前>(.ui).config.ts`。placement の点の glob に当たる物 → そのパス。placement の点を宣言したフォルダの物で、直下に同じ名前の物がある → その直下の物(`src/styles/core/palette.css` → `src/styles/palette.css`)
  - `none`: どれでもない → `order` = `/order <直接の親>`
- 文の出力: 型の行の下の `このファイル自体:` の行は、そのファイルを直接書き換える・足す話(README「持ち主を調べる」のできること)。型が none 以外なら、このファイル自体の「受け口が無い → /order」は出さず「書き換えない(変え方は上の型)」と書く(`--json` の `allowed` は同じ)

```text
src/lib/cron/config.ts
  持ち主: Tier1
  型: 型 4 置き場 — 地区の値は上書きのファイルに変えたいキーだけ書く
  置くファイル: src/config/lib/cron.config.ts
  元: lib cron
```

```json
{ "path": "src/domains/core/user/roles/editor.role.json", "owner": { "kind": "tier1", "tier": "tier1" },
  "type": "2", "keys": ["label", "hasProfile", "enabled"], "write": "src/domains/core/user/roles/editor.role.override.ts",
  "source": "src/domains/core/user/extensionPoints.ts roleDefinitions", "allowed": [...], "blocked": [], "evidence": {...} }
```

### CI

- CI は任意。必ず走るのは `/flux` の各区間の verify と手元のコマンド
- コマンドは CI でも動く: git の情報だけで判定する・親の場所を remote か環境変数で受け取る・対話しない・終了コードで結果を返す。CI で使いたい fork は自分で設定する(親を取得できる checkout にし、shallow にしない)

## Verification

- `pnpm test src/lib/forkOwnership scripts/structure/extensions/intakeOwnership.test.mjs`(判定・一時許可・who・受け口の一覧の書式と鮮度・負債の行の実在と依頼の番号)
- `pnpm test src/lib/forkOwnership/regions.test.mjs`(受け口の一覧で region の全ファイルの対が閉じている・入れ子が無い・文言が正しい・古い印が残っていない + 部品の単体テスト)
- 型の答え: `who.test.mjs` の「型の答え」(代表のパスの表と、このリポの HEAD の代表のパス)

## Related

- [`folderCatalog`](../folderCatalog/README.md): 目録(`CATALOG.md`)と実在のディレクトリの整合、lib 単位の所有(目録の節)による lint の厳しさ。forkOwnership は直接の親との差分から、受け口の外の書き換え・削除・祖先 lib への追加を見つける
- 点つきの名前の分類: `src/lib/districtMap/dottedNames.mjs`([districtMap の README](../districtMap/README.md))。判定の核(`judge.mjs`)もそこを読む
- `.notices/README.md`「解決(resolves)」「緊急修正(hotfix)」
