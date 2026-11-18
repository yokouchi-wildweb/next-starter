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

- 終了コード: 0 = 合格(Tier1 は「親なし: 対象外」)/ 1 = 違反あり / 2 = 未検証・設定の不足(合格にしない。条件は Internals.md「鮮度」)
- `/flux`: 基準に `intake.txt` がある区間は、区間を commit した後・push の前に走らせ、1 と 2 は停止条件(片付けを追加の commit で積み、0 になってから push する)
- 出力: 先頭に結論と基準(remote・branch・base)、reason ごとの件数、違反と一時許可の残骸・書式の誤りの一覧
- 違反には、今の指紋で書いた一時許可の行の下書きが付く。一時許可で片付けるときは、`<依頼の番号>` と `<理由>` を埋めて `.fork-ownership/<名前>.permits.txt` に貼り、commit してから検査し直す
- 一時許可の依頼の出し方は `/order`「一時許可の依頼」、依頼の状況は `/wen permits`、放置と project.md の食い違いは `/flux` の最終報告(上流への所見 (e)(f))に出る
- 判定の中身と手順: [Internals.md](./Internals.md)「判定」「検査の手順」

### 持ち主を調べる(pnpm workflow ownership who)

ファイルの持ち主は git の分岐点で決まるので、名前を見ても分からない。`pnpm workflow ownership who` はパスごとに、持ち主・できること・根拠・変え方の型を答える。読むだけ(リポのファイルは書かない。親の取得 `git fetch` は remote の ref だけを動かす)。

```sh
pnpm workflow ownership who <path...>          # フォルダは中のファイル(HEAD ∪ 基準)に広げて 1 ファイルずつ答える
pnpm workflow ownership who <path...> --json   # 機械向け(エージェント・集計)
pnpm workflow ownership who <path...> --no-fetch --parent=upstream --branch=main
```

- 前提(名前・基準・受け口の一覧・鮮度・Tier1 の版)と判定は `pnpm workflow ownership check` と同じ。「足したら」の答えは同じ `judge` に仮の A を渡して出す
- 持ち主(`owner.kind`): `tier1` = Tier1 の版にある / `middle` = 基準にあるが Tier1 の版に無い(`owner.forkId` = その版を持つ、Tier1 に最も近い中間 Tier の `repo_id`)/ `fork` = 基準に無く HEAD にある / `generated` = 受け口の一覧の generated の行に当たる(`owner.tier` に元の持ち主)/ `missing` = 基準にも HEAD にも無い
- できること(`allowed`、無ければ `none`)
  - `edit`: Tier1 の物は受け口の kind ごと(edit = 書き換え可 / region = fork の区画の中だけ / marker = 印より下だけ / append = 追記だけ / generated = 生成器で作り直す)。中間 Tier の物・fork の物は書き換え・削除・rename 可
  - `add`: 無いパス。judge が `added`(中間 Tier の lib なら `middle-tier`)なら可、違反の reason は `blocked` に出る
  - `replace`: `<名前>.replace.ts(x)` を名指しする add の行があり、足しても合格のとき
  - `override`: `<対象>.override.ts`(cron のフォルダは `task.override.ts`)を名指しする行があり、足しても合格のとき。`src/config/**` のような広い edit の行では上書きの口があるとは言わない
  - `none` = 受け口が無い → `/order <直接の親>`(要るまでの間は一時許可)
- 根拠(`evidence`): 基準・Tier1 の版・HEAD にあるか / 当たった受け口の行 / 今の差分(違反なら一時許可の行の下書き)/ 自分の一時許可の行。冒頭に基準と Tier1 の版(台帳の鎖)
- 型(`type`・`keys`・`write`・`source`): fork がこのパスを変えたいときにすること。判定の順は [Internals.md](./Internals.md)「型の答え」
- Tier1 では「直接の fork から見たら」を答える(基準 = HEAD、受け口の一覧 = HEAD の版)。冒頭に「このリポ = Tier1: 自由に編集できる」
- 終了コード: 0 = 答えた / 2 = 未検証・引数の誤り

## API

関数の形は [API.md](./API.md)(受け口の一覧・判定の核・一時許可・区画・基準の版・repo.json・lineage.md・検査の本体)。

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
  | generated | 生成物 → `generated` | — |
  | debt | — | `debt`(upstream の負債の箇所。一時許可で通す) |
  | self | 書き換え → `self` | — |

- self(型 5: 各リポが自分の版を持つ): `.claude/rules/project.md`・`.claude/rules/behavior.md`・`repo.json` の 3 行だけ、1 ファイル 1 行・ぴったりのパス。`pnpm workflow ownership who` は型 5 と答える。中身は見ず、`pnpm workflow ownership check --self` が 4 つだけ見る: ファイルが無い・self の行が 3 行ちょうどでない・取り込みの merge で親の版が入ったまま・Tier1 でないリポの project.md が直接の親の版と同じまま。既定は切で、文脈の書き直しの最後の切り替えで入る
- 載せている物(手書き = src の外だけ): リポジトリ直下の 6 種(package.json・pnpm-lock.yaml・.gitignore・.env.example・next.config.ts・.mcp.json)と README.md・`eslint.config.fork.mjs`・firebase.json / ロゴ(public/)/ room の登録点(region)と wrangler.toml / `.claude/rules` の PER_PROJECT と marker・lineage.md(append)/ 負債(debt)。src の下の行は全部生成区画(Internals.md「受け口の一覧の生成区画」)
- 外のままにした物と理由: `eslint.config.mjs`(fork の設定は `eslint.config.fork.mjs` に書く。upstream は空の配列で出荷し、`eslint.config.mjs` が最後に読み足す)/ `tsconfig.json`(paths の不足は upstream で直す。要るなら一時許可 + 依頼)/ `AGENTS.md`(`next dev` が書き足す `<!-- BEGIN:nextjs-agent-rules -->` の区画は生成器の区画として除く)/ 既存の `eslint-rules/*.mjs` の書き換え(新しい規則のファイルは追加なので合格)
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
- 状態(valid / refresh / expired-base / expired-resolved / 残骸)と指紋の取り方: Internals.md「一時許可の照合」

### registry の fork の区画

- `src/registry/` と、受け口の一覧で region にしたファイル(`servers/room/src/registry.ts`。シードは各ドメインの `seed.ts` で登録点を持たない)の中で fork が書いてよいのは、次の印の対の間だけ。印の外は upstream の物
  ```ts
  // --- fork entries start (upstream never edits inside) ---
  // --- fork entries end ---
  ```
- 1 ファイルに複数の対を置ける。fork の登録は import を伴うので、import 文の後にも対を置く
- 文言は `.claude/rules/` の marker(`fork entries below (upstream never edits below this line)`)と語を揃えている
- 生成器の区画(`AUTO-GENERATED` 系)は fork の区画ではない
- 古い下流の印 3 通り(`// --- DOWNSTREAM (downstream で追加) ---` / `// --- ここに…（上流は空。下流が追記） ---` / `// --- FORK (手書き) ---`)は、`regions.mjs` が移行のために読める(終わりは字下げの浅い閉じ括弧)

### リポの名前と段(repo.json)

- 置き場: リポ直下の `repo.json`(機械用の値のファイル)。平らな鍵を 1 鍵 1 行(リポの外の sh も grep で読める)、値は文字列か真偽値だけ(入れ子・配列・数は誤り)。どのリポも自分の版を持つ(受け口の一覧に `self repo.json`)
  ```json
  {
    "repo_id": "next-starter",
    "tier": "root"
  }
  ```
- `repo_id` = 自分の名前。全リポ(Tier1 = `next-starter`)が書く。台帳 `.notices/applied/<名前>.md`・一時許可 `.fork-ownership/<名前>.permits.txt`・`src/lib/CATALOG.md` の節の見出し・受信箱も同じ名前。使える形: 小文字・数字・ハイフン(ファイル名になるので `.` は不可)。名前は `/fork-init` が最初に聞いて作る(既定 = リポ名の小文字、既知の名前と重なれば止まる)
- `tier` = `root`(Tier1)| `middle`(下流の fork を持つ・持つ予定)| `leaf`(末端)。無い = `leaf`。下流の有無はここから導く(root・middle = yes、leaf = none)。`/ship`・`/flux` の中継判定・`.claude/rules/lineage.md` の検査はこの値を使う
  - 見張り: `root` ⇔ 自分の名前が `src/lib/CATALOG.md` の先頭の節(両向き)。食い違い・知らない値は `downstreamError`。止めるのは pnpm workflow ownership check(未検証 = exit 2)と lineage.md の検査だけで、`pnpm check extensions`(`pnpm build`)は止めない
- `agent.<種類>` = エージェントに任せる方針の鍵(読むのは devcheck)。ほかの鍵は `errors`
- 親(上の Tier)の名前: `.notices/applied/*.md` の台帳名から自動で集める(台帳は `/flux` が作り、子の fork にも受け継がれる)
- 書く命令: `pnpm workflow repo-json set <鍵> <値>`(と `/fork-init`)。古い形(`.claude/rules/project.md` の `fork_id:` / `downstream:` の行)からの移しは `pnpm workflow repo-json migrate`(`scripts/workflow/repo-json/README.md`)。古い形を読むのは過去の版を読む所(多段の台帳の鎖・`ownership who` の中間 Tier・safe point の親の名前)と移しの命令だけ

## Internals

判定・単位名・受け口の一覧の生成区画・一時許可の照合・緊急修正の pick・検査の手順・鮮度・多段の Tier・中間層の規則・型の答え・CI は [Internals.md](./Internals.md)。

## Verification

- `pnpm test src/lib/forkOwnership scripts/structure/extensions/intakeOwnership.test.mjs`(判定・一時許可・who・受け口の一覧の書式と鮮度・負債の行の実在と依頼の番号)
- `pnpm test src/lib/forkOwnership/regions.test.mjs`(受け口の一覧で region の全ファイルの対が閉じている・入れ子が無い・文言が正しい・古い印が残っていない + 部品の単体テスト)
- 型の答え: `who.test.mjs` の「型の答え」(代表のパスの表と、このリポの HEAD の代表のパス)

## Related

- [`folderCatalog`](../folderCatalog/README.md): 目録(`CATALOG.md`)と実在のディレクトリの整合、lib 単位の所有(目録の節)による lint の厳しさ。forkOwnership は直接の親との差分から、受け口の外の書き換え・削除・祖先 lib への追加を見つける
- 点つきの名前の分類: `src/lib/districtMap/dottedNames.mjs`([districtMap の README](../districtMap/README.md))。判定の核(`judge.mjs`)もそこを読む
- `.notices/README.md`「解決(resolves)」「緊急修正(hotfix)」
