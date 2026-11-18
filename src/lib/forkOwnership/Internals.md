# forkOwnership Internals

## Overview

- forkOwnership の検査の仕組み。使い方と決まりの置き場は [README.md](./README.md)、関数の形は [API.md](./API.md)

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
     - 基準の `src/lib/<name>/` が実在する `<name>` の中 → `ancestor-lib-add`(自分の lib に置いて re-export する)。祖先の lib かどうかは基準の git だけで決まるので、`folderCatalog` の目録は使わない
     - 基準に `src/features/core/` があり、足したパスがその中で受け口(`intake.txt` の debt 以外の行)に当たらない → `core-add`(fork のドメインは `src/features/<x>/`、画面の部品は route の `_components/`)
     - 基準に `src/featureGate/`(門番)があり、足したパスがその中で受け口に当たらない → `gate-add`(足せるのは `rules/`・`alwaysOnExceptions/`・`required/` の `<名前>.ts`)
     - 基準に `.claude/rules/core/` があり、足したパスがその中 → `rules-core-add`(自分の決まりは `.claude/rules/` の `core/` の外に印なしの名前で、自分の品目の札は `.claude/rules/items/`。受け口の行は効かない)
     - 検査する場所への追加で、単位名が基準のファイルと同じ → `unit-clash`(`x.ts` と `x.tsx`、ファイルとフォルダの組。別の名前にするか、丸ごと置き換えは `<名前>.replace`)
     - `<対象>.override.ts(x)` で、対象が基準に無い → `override-own`(fork が自分で足した項目への override。中間 Tier の項目は下の Tier の基準にあるので可)
     - `<名前>.default.<拡張子>` で、同じフォルダに基準のファイルがある → `default-add`(既定はそこを作ったリポの物。自分のフォルダの自分の既定は可、中間 Tier も自分のルートに出してよい)
     - src/app の印なしの `frame.ts` で、同じフォルダに基準のルート(page / layout / 枠の宣言)がある → `frame-plain`(移し替え `pnpm check extensions -- frames-move`)。src/app の `frame.override.ts` の相手は基準のルートで、ルートの無いフォルダなら `override-own`
  2. D → `deleted`、R(元が基準にある)→ `renamed`。受け口の中でも違反(config の削除、`_` 付きへの rename も)
  3. M → 基準の `<名前>.default.<拡張子>` の書き換えは `default-edit`(違反、受け口の行より先に見る)。それ以外は受け口の一覧で当たった kind ごと(README「受け口の一覧」の表)。どれにも当たらなければ、生成器の区画の中だけの差なら `generator-region`(合格)、それ以外は `outside-intake`(違反)
- 生成器の区画(`AUTO-GENERATED-START/END`・`=== AUTO-GENERATED … START/END ===`・終わりの印の無い `// --- Auto-generated imports ---` = 続く import の行まで・道具が丸ごと書き足す `<!-- BEGIN:nextjs-agent-rules -->` 〜 END = 印の行と直前の空行ごと)は検査の対象外。`#` でコメントを書くファイルの対 `# === AUTO-GENERATED <name> START/END ===` も生成器の区画
- 区画の中身を除いたテキスト(`stripOwnedRegions`)が基準側と fork 側で同じ = 区画の中だけの書き換え。一時許可の指紋もこのテキストから取る

### 単位名

単位名 = パスから最後の拡張子と末尾の `/index` を除いた名前(`.replace` / `.override` は名前に残す)。

- 検査する場所(これだけ。components・hooks・utils・`src/lib` は対象外)
  - 直下の項目だけ: 基準の `src/**/extensionPoints.ts` の受け口のフォルダ(宣言は `src/lib/districtMap/declarations.mjs` で読む、`dir: "."` = 持ち主の直下)・`src/wiring`・`scripts`(門番の例外 `src/featureGate/alwaysOnExceptions` は宣言の受け口)
  - その下全部: route の隣(`src/app/**/_layout`・`_screen`・`_components`)
- `unit-clash`・`override-own`・`default-add`・`default-edit`・`frame-plain` は持ち主によらず止める(多段で `middle-tier` に付け替えない)

### 受け口の一覧の生成区画

- 受け口の行(生成区画 `# === AUTO-GENERATED intake START ===` 〜 `END`)は `pnpm generate extensions` が書き、ずれは `pnpm check extensions` が止める(`scripts/structure/extensions/README.md`「受け口の一覧の生成区画」)。src の下の行は全部ここで、出どころは 4 つの型:
  - 画面の差し替え(型 1): ルートの `page.tsx`(ルートの地図と同じ見つけ方、上流のルートごと)・枠の 1 行スイッチの `layout.tsx` = `edit` / 1 行スイッチ(src の下の `<名前>.default` の隣の素の名前 = `edit`、`<名前>.replace` = `add`。`src/app/_providers/ForkProviders.tsx` もこれ)/ `_layout`・`_screen` の隣の `*.replace` と下のリポの枠の宣言 `frame.override.ts` = `add`
  - 受け口と上書き(型 2・3): 宣言の受け口のフォルダ(`<dir>/*.{ts,tsx}` とフォルダ形 `<dir>/*/**`)= `add` / 上書きの対象の点(宣言の `overrides`)の隣の `.override.ts`(cron の `task.override.ts`・`domainEntry.override.ts`・ロール / core ロール / プロフィール)= `edit`、`addable` の対象(ロール・プロフィールの JSON)= `add`
  - 置き場(型 4): 持ち主の `extensionPoints.ts` の placement の点 = `src/config/**`(src/lib/districtMap)・`src/styles/*.css`(src/styles/core)・`src/business/**`(src/lib/business)・`src/app/favicon.ico`(src/app/_layout)・`src/app/**/_components/**`(src/lib/screens)= `edit`、`src/lib/CATALOG.md`(src/lib/folderCatalog)= `append`
  - 生成物と区画: 生成器の `gate.json` の `outputs` = `generated`(registries・`src/wiring/dbAgent.ts`・地区の地図・ルートの地図・mail の色・profiles の entities・`src/**/extensions/**`・`vercel.json`)、`regions` = `region`(`src/registry/**/*.ts`)。区画の最後に並ぶ(同じファイルなら生成物が効く)
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
- 依頼の解決: 基準(取り込み済み)の消えない索引 `.notices/shipped/*.md` の行と本文(`.notices/` と `done/`)の `resolves:` を集め(和をとる。親が本文を片付けても索引の行で失効は変わらない)、すべての番号が解決した許可を expired-resolved にする
- 検査が見るのは依頼の番号の形だけ(`UPREQ_ID`)で、どの受信箱の指令かは見ない。自分宛ての指令は親の notice の `resolves:` に載らないので、fork が自分で行を消すまで残る(親がファイルに触れば expired-base)

### 緊急修正の pick

親の緊急修正・先に取れる修正(`pick: clean`)を cherry-pick しても基準は動かないので、受け口の外のファイルはそのままだと違反になる。台帳の `picked:<sha>` がこれを通す。

- 台帳の行: `upstream:` は今の merge-base のまま(進めると Tier1 の版の判定がずれる)、`picked:` に pick の元の commit を書く(`.notices/README.md`「緊急修正(hotfix)」)
- 判定: 基準に pick を順に当てた中身と HEAD の中身が同じファイルを `picked`(合格)にする。fork が更に変えた・fork の編集が元からある・元の commit が取得できないときは違反のまま
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
- 取り込み済み(基準の索引の行 ∪ 基準の本文)なのに自分の台帳(`.notices/applied/<名前>.md`)に記録の無い notice がある。fork を作った時点の索引の行とツリーの notice は継承済みとして除く(`/flux` と同じ求め方)
- lint の厳しさは手元の情報だけで決める(確かめられなければ今のパスでの判定)。この検査とは別

### 多段の Tier

- 厳密に判定するのは Tier1(`src/lib/CATALOG.md` の先頭の節 = next-starter)の物だけ。Tier1 の版にあるファイルは受け口の中だけ書き換え、削除・rename は違反。無いファイル = 中間 Tier 以下の物は、書き換え・削除・rename を合格(reason `middle-tier`、`--verbose` で参考の一覧)
- 祖先の lib への追加は、その lib が Tier1 の版にあるときだけ違反
- `.claude/rules/service/` の下は中間 Tier が足した物も付け替えない
- Tier1 の版の決め方: 自分の台帳の最後の `upstream:<sha>` の版から、その版に `.notices/applied/` があれば、その版のリポの名前(その版の repo.json の `repo_id`、古い版は project.md の `fork_id:`)の台帳の最後の `upstream:` へ … と、`.notices/applied/` の無い版(Tier1)に着くまでたどる。段数に依らない
- 未検証(exit 2): 台帳に `upstream:` が無い・その sha が履歴に無い(squash・rebase)・途中の版に名前か、その名前の台帳が無い・循環・10 段を超える
- override: Tier1 は override を出荷しない(`pnpm check extensions` が検査)ので、親の override は中間 Tier の物。下の Tier は消しても空(空白とコメントだけ = 不在と同じ)にしてもよい
- 多段にするのはファイルを足す型(setting のキーとセクション・extensions の項目・wiring と proxy の fork が足したファイル・featureGateRules・override・`.replace`(`src/app/_providers/ForkProviders.replace.tsx` も))だけで、並べ替えの仕組みは無い
- `/flux` は下の Tier が中間 Tier の物を消した・書き換えた後の取り込みの衝突を、下の Tier の判断を保って解き、報告と台帳の `notes:` に残す
- 中間 Tier の既定の削除・rename はまだ `middle-tier`(合格)

### 中間層の規則(lineage.mjs)

`.claude/rules/lineage.md`(仕様 = その前置き)の検査。git に触れない純関数だけで、git を読むのは呼び手。

- 構造(`checkLineageStructure`): 前置き → `<!-- end preamble -->` → `## <fork_id>` の節を古い祖先から順(自分は在れば最後)、各節は `<!-- end <fork_id> -->` で閉じる。`tier` leaf のリポが自分の節を持つ = 失敗
- 打ち消し(`checkOverrides`): 名指せるのは祖先の節の `(default)` の鍵だけ。鍵が無い・`(default)` でない・同じ project.md か同じ節で同じ対象を 2 回 = 失敗。祖先の鍵と同じ名前の鍵が project.md に overrides の行なしである = 警告
- 接触(`touchedOverrides`): `/flux` が取り込む前後の lineage.md を比べ、自分の打ち消しが名指す鍵が変わったら止める(`.claude/skills/flux/lineage-touch.mjs`)
- `runCheck` の `lineage` 欄の failures は違反と同じく exit 1、件数は reason `lineage`。lineage.md の無い版は `checked: false`。祖先の部分が基準どおりかは受け口 `append .claude/rules/lineage.md` の判定が見る
- 書式(`formatProblems`): `pnpm check rules` が全リポで同じ parser を使って見る(前置きの終わりの印・節の閉じ・節の中の鍵の重複)

### 型の答え(`explain.mjs`)

`pnpm workflow ownership who` の答えに `type`・`keys`・`write`・`source`(と `how`、none のとき `order`)を加える。判定に使う木は持ち主と同じ(Tier1 は HEAD、fork は直接の親との基準)で、読むのは宣言(`extensionPoints.ts`)・地区の見つけ方・ルート・名前の決まり(`src/lib/districtMap/extensionNames.mjs`)・受け口の一覧の kind・生成器の `gate.json`・`pnpm generate domain` の出力の種類(`scripts/structure/domain/gate.json` の `outputs`)。受け口の一覧の行の注記の文言は読まない。ownership check の合否は変えない(答えは案内)。

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
{ "path": "src/features/core/user/roles/editor.role.json", "owner": { "kind": "tier1", "tier": "tier1" },
  "type": "2", "keys": ["label", "hasProfile", "enabled"], "write": "src/features/core/user/roles/editor.role.override.ts",
  "source": "src/features/core/user/extensionPoints.ts roleDefinitions", "allowed": [...], "blocked": [], "evidence": {...} }
```

### CI

- CI は任意。必ず走るのは `/flux` の各区間の verify と手元のコマンド
- コマンドは CI でも動く: git の情報だけで判定する・親の場所を remote か環境変数で受け取る・対話しない・終了コードで結果を返す。CI で使いたい fork は自分で設定する(親を取得できる checkout にし、shallow にしない)
