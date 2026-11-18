# screens — Internals

## Overview

screens の README の Internals を分けた文書(README が 20,000 字を超えるため)。検査による保護・未移行のルート・生成される管理画面のルート・ルート地図。

## Internals

### 仕組みによる保護（`pnpm test src/lib/screens/screens.test.mjs`）

検査対象は自動検出する。登録は不要。

| 検出 | 範囲 |
|---|---|
| page.tsx | **`src/app` 全体**のページ（`page.tsx` / `.ts` / `.jsx` / `.js` / `.mdx`。`routeTree.mjs` の `discoverRoutes`、ルート地図と同じ発見）。外れるのは `_` で始まるディレクトリ（`admin/_template` 等）と `src/app/api` だけで、`@slot`（parallel routes）は含む。そこから構造の検査の除外（upstream の `SCAN_EXCLUDES` は空、fork の `FORK_SCAN_EXCLUDES`）の配下を外す。除外したページもルート地図には載る。fork の独自エリア（`store/`・`terminal/`・`m/` 等）も登録なしで検査される |
| ルート内 loader | 検出した各ルートの `_screen/loader.ts` と `_components/loader.ts`（あるものだけ） |

- page.tsx を太らせない — 検査: `parseSwitchPage`: `./_screen/<X>` または `./_components/<X>`（`<X>` は印なしの既定か丸ごと置き換えの `<X>.replace` だけ。旧い fork の印は失敗
  - `_screen/<X>.replace` はファイルが下の「route の隣の点つきの名前」で失敗する）からの re-export 1 つ（default + `metadata` / `generateMetadata` / `viewport` / `generateViewport` のみ）+ 任意の設定 export + `generateMetadata` + それらに必要な import（`next` / `@/lib/*` / `@/config/*` / `./_screen/loader` / `./_components/loader`）。JSX・セクションコンテナ・hook・`next/navigation` の import は不可; 結果: スイッチ形でなければ**失敗**（例外リストにあれば skip）
- Screen の欠落・形 — 検査: `checkScreenFile`: 参照先（`<X>.tsx` → `<X>/index.tsx` → barrel 1 段）が存在し、名前を named export、default export と `"use client"` を持たない; 結果: 失敗
- Screen が部品を直接読まない — 検査: `checkScreenImports`: `@/features/**/components/` の import 先の途中に `index.tsx` を持つディレクトリ（= コンテナ）があれば違反（API.md「セクションコンテナの条件（契約 D）」）。ファイルの有無は test 側の `isContainerDir` が見て、checker には述語で渡す; 結果: 失敗
- loader の規律 — 検査: `checkLoaderFile`: `import "server-only"`、`createLoader(`（か `cache(`）、`load<Xxx>` の export、`_components/` / Screen からの import 無し（型含む）。最寄りの guard.ts の createLoader かは地図（「ルート地図（`src/app/route-map.jsonl`）」）が見る。補助関数は `utils/` へ; 結果: 失敗
- Screen → loader — 検査: `checkScreenLoaderCall`: 同じルートの loader を import し、本体の最上位（最初の `return` より前）で await する; 結果: 失敗
- 管理のページは AdminPage を描く — 検査: `checkAdminPageScreen`: `src/app/admin` の下の全ページの Screen が `AdminPage`(`@/app/admin/_layout/AdminPage` か相対の `…/_layout/AdminPage`)を import して `<AdminPage …>` を描く。管理のヘッダーの行は AdminPage が描くので、描かないページにはヘッダーが出ない。字面で Screen のファイル自身を読む: 子の部品の中で AdminPage を描く形は読まずに止める(Screen が AdminPage を描き、子はその中に置く)
  - ヘッダーを出さないページも AdminPage で包み、隣の `frame.ts` の宣言でヘッダーを隠す。全 Tier・例外なし。ルート地図(`pnpm generate routes`)も同じ関数で行の問題にする; 結果: 失敗
- 枠の layout.tsx を太らせない — 検査: `parseSwitchLayout`（`parseSwitchPage` と同じ本体。参照先は `./_layout/<X>` か `./_layout/<X>.replace`）: `FRAME_LAYOUTS`（screens.test.mjs、upstream の枠を描く layout.tsx）と、`./_layout/` を指す re-export を持つ全ての layout.tsx。参照先は `checkLayoutTarget`（named export あり・default export なし。`"use client"` は可）。全 Tier で検査（fork も採用者所有のスイッチを持つ。fork がルートを消してファイルが無ければ対象外）; 結果: 失敗
- 除外の鮮度 — 検査: `FORK_SCAN_ROOTS` に行が残っていない（全体走査で不要になった。export は互換のため残す）。`FORK_SCAN_EXCLUDES` の登録が `src/app/...` の形で、ディレクトリとして存在し、重複せず、他の除外の中にないこと; 結果: 失敗
- URL の重複 — 検査: 別の group に同じ URL のページが 2 つない（Next もビルドで失敗する構成）; 結果: 失敗
- upstream の置き場の印 — 検査: Tier1（`src/lib/CATALOG.md` の先頭節の持ち主 = 自分）でだけ: `findForkOwnedDirFiles` = `src/app` に `_components/` のファイルが無い、`findDotNamedFiles` = `_screen/`・`_layout/` に fork の置き換えの印（丸ごと置き換え `.replace`・一部の上書き `.override`、`classifyDottedName` の判定）が無い（点つきの名前を全部止めるのではない: 1 行スイッチの既定 `<名前>.default`、例 `admin/_layout/AdminHeader.default.tsx`・枠の描画用の設定 `config.ui.ts`・テストは印でないので数えない）
  - `_` の意味は場所で違う（`_screen/`・`_layout/` = 提供者の既定、`_components/` = fork 所有）ので、upstream が fork の置き場や印を使うと fork の物と衝突する。demo の部品も `_screen/` に置く; 結果: 失敗（fork では skip）
- route の隣の点つきの名前 — 検査: 全 Tier: `findMarkerNamedFiles` = `_screen/`・`_layout/` の点つきの名前は `<名前>.replace`（と `.test`、1 行スイッチの既定 `<名前>.default`。スイッチの形は `pnpm check extensions` の `switches.mjs`
  - 枠の `_layout/` の直下の描画用の設定 `config.ui.ts` = 地区の `UI_CONFIG_FILE` も許す）だけ（旧い fork の名前の印は失敗、移し方 = 共有の棚の印の移行の notice）、`findRouteReplaceProblems` = `_screen/` の下の `.replace` は向け先でも `.default` の隣でも全部失敗（in-screen。案内 = `<route>/_components/<X>Screen.tsx` に置いて page.tsx の 1 行スイッチを向ける
  - README.md「ルートの構造と所有権」「fork の物は `_components/`」）、`_layout/` の `<名前>.replace` は置き換える既定を持つ（そのルートの layout.tsx の 1 行スイッチの向け先か、隣の `<名前>.default`。隣に印なしの部品があるだけは不可 = fork の部品は `_components/` に印なしの名前で。文は `describeRouteReplaceProblem`、`pnpm check extensions` も同じ文を出す。`pnpm check extensions` の孤立の検査も回す）; 結果: 失敗

fork が作った区域（`src/app/store/**` 等）も、upstream の区域の中に足したページ（`src/app/debug/<x>`・`admin/(protected)/<x>`）も、登録なしで検査される。検査したくないディレクトリ（実験場・デモ）は `FORK_SCAN_EXCLUDES` に書く（未移行のページを残す例外リストは無い、「未移行ルートの扱い（例外リストは無い）」）。fork がローカルに screens テストの写しを持つ必要はない。

```ts
// src/config/app/screens.config.ts(fork で編集)
export const FORK_SCAN_EXCLUDES: string[] = ["src/app/lab"];
```

テストは tsx ランナーで動く（`screens.config.ts` の `.ts` を読むため）。pre-commit / CI ガードは置かない。
既知の限界: `stripComments` は正規表現リテラルを追跡しない。`//` や引用符・バッククォートを含む正規表現が page.tsx / Screen / loader にあると判定がずれることがある（検査対象のファイルでは稀。必要なら正規表現を `utils/` に逃がす）。

### 未移行ルートの扱い（例外リストは無い）

スイッチ形でない page.tsx は `pnpm test src/lib/screens/screens.test.mjs` が失敗にし、ルート地図（「ルート地図（`src/app/route-map.jsonl`）」）も鎖を辿れないページで生成失敗になる。未移行のページを理由付きで残す例外リスト（upstream の `UPSTREAM_LEGACY_ROUTES`・fork の `FORK_LEGACY_ROUTES`）は仕組みごと廃止した。新しいページは最初からスイッチ形で作る。fork が merge の後に `FORK_LEGACY_ROUTES` の行を持っていたら消す。

### 生成される管理画面ルート（pnpm generate domain）

`pnpm generate domain` が出す管理画面ルート（`src/app/admin/(protected)/<domains>/`、`new/`、`[id]/edit/`、`sort/`）も同じ構造で生成される。
テンプレートは `src/app/admin/_template/__domains__/`、生成器は `scripts/structure/domain/render/adminRoutes/`。

```
src/app/admin/(protected)/samples/
├── page.tsx                          write-once。初回だけ生成、以後 pnpm generate domain は上書きしない(fork 所有)
│                                     export const dynamic = "force-dynamic";
│                                     export { AdminSampleListScreen as default, metadata } from "./_screen/AdminSampleListScreen";
├── _screen/AdminSampleListScreen.tsx 毎回再生成(手で編集しない)。metadata もここ(ラベル変更が再生成で反映される)
└── _components/                      fork 所有。生成器は触らない
```

| 所有 | 対象 | 生成器の扱い |
|---|---|---|
| fork（write-once） | `page.tsx` | 無ければ生成。既存なら保持。旧形式（本体を直接持つ `export default`、`_screen/` も `_components/` も参照しない）なら一度だけ 1 行スイッチへ移行してログを出す |
| 生成物（編集しない） | `_screen/<Name>Screen.tsx`・`_screen/loader.ts` | 毎回上書き |
| fork | `_components/` | 触らない |

- `_screen/loader.ts` は最寄りの guard.ts（`admin/(protected)/guard.ts`）の `createLoader` に `src/wiring/adminScreenParts.ts` の共通部品の組（`adminListParts` / `adminEditParts` / `adminCreateParts` / `adminSortParts`）を渡す 1 行。access は serviceRegistry の entry から汎用 API と同じ解き方で操作ごとに解き、範囲の方針と合わせて取得前に評価する。取得本体と規則は `src/features/core/admin/services/server/screenData/README.md`
- 生成された管理画面を変えたい fork: `_screen/` を `_components/` にコピーして page.tsx を向ける。以後の `pnpm generate domain` は `_screen/` を更新し続け、page.tsx と `_components/` は保持される。ドメイン固有のサーバー側判定が要るなら `_components/loader.ts` に書く（同じ guard.ts の `createLoader` で作る）
- 生成ルートも `pnpm test src/lib/screens/screens.test.mjs` が自動検出して検査する（domain.json から導出）

### ルート地図（`src/app/route-map.jsonl`）

全ページの「守りの鎖」を 1 ページ 1 行の JSON（JSON Lines）にした生成物で、コミットする。主な読み手はエージェント（機械が読む構造化データ）。人が読む形は `pnpm check routes -- show`。発見は 「仕組みによる保護（`pnpm test src/lib/screens/screens.test.mjs`）」 と同じ `discoverRoutes`（`src/app` 全体、構造の検査の除外も含めて全ページ）。

| コマンド | 用途 |
|---|---|
| `pnpm generate routes` | 地図を書き出す。ページ・Screen・loader・guard.ts を変えたら実行してコミットする。鎖が読めないページがあれば行と理由を出して exit 1（地図は書かない）。feature-gate の config（.ts）を読むので tsx で動く |
| `pnpm check routes` | 地図が生成結果と一致するか検査する（ずれていれば exit 1） |
| `pnpm test 'src/lib/screens/routeMap*.test.mjs'` | 生成器の fixture テスト + 同じずれ検査 + 全行 verified + 見る側（`routeMapView`）のテスト |
| `pnpm check routes -- show [<URL 接頭辞>] [オプション]` | 地図を絞り込んで描く（下の「見る」）。引数なし・URL 接頭辞だけは段ごとの鎖（page → Screen → loader の access → guard.ts の段ごとの access と行き先） |

見る（`pnpm check routes -- show`、`--help` で一覧。人に説明させるときはスキル `/route-map` が依頼を引数に直して結果を読み解く）:

- 入力: 既定は src/app から作り直した値（コミット前の変更も映る。鎖が読めないと exit 1）。コミットされた地図とずれていれば stderr に `! 地図が古い` の 1 行。`--file=<path>` は地図ファイル（JSON Lines）をそのまま読む（fixture・別の版の地図）
- `--view=`: `details`（既定。段ごとの鎖）/ `tree`（URL の木。ページの行に access・最寄りの範囲・gated-off）/ `table`（Markdown の表。page.tsx のフォルダ = route group が見える列、guard は最寄り → root）/ `mermaid`（guard.ts の範囲を extend の親子で入れ子の subgraph、ページは最寄りの範囲の箱、止めたページは点線）/ `jsonl`（絞った行を地図と同じ形で。エージェント向け）
- 絞り込み（同じオプションは OR、別の種類は AND）: `<URL 接頭辞>`（セグメント単位）/ `--scope=<範囲>`（`admin/(protected)`・`src/app/admin/(protected)`・`/`。その範囲と配下の範囲、`--nearest` で最寄りの guard.ts だけ）/ `--access=`（loader の access: `public`・`authenticated`・`role:<r>`・`category:<c>`・`registry[:<domain>[.<op>]]`・`statuses` = allowStatuses あり）/ `--state=`（`verified`・`gated-off`・`live`）
- 表の access は `--access` と同じ言葉（`{"roleCategories":["admin"]}` → `category:admin`）。details の表示は今までどおり
- `( )` を含む値はシェルで `'…'` で囲む。引数の誤りは説明つきで exit 2

1 行（キーの順は固定、行は path 順。改行は入れない。ここでは読みやすく折り返す）:

```
{"path":"/admin/users/general","slot":null,"state":"verified","gatedOff":null,"chain":[
  {"kind":"page","file":"src/app/admin/(protected)/users/general/page.tsx"},
  {"kind":"screen","file":"…/_screen/AdminGeneralUserListScreen.tsx","name":"AdminGeneralUserListScreen"},
  {"kind":"loader","file":"…/_screen/loader.ts","access":{"roles":["admin"]}},
  {"kind":"guard","file":"src/app/admin/(protected)/users/guard.ts","policy":{"access":{"roles":["admin"]},"redirectTo":"/admin","forbiddenRedirectTo":"/admin"}},
  {"kind":"guard","file":"src/app/admin/(protected)/guard.ts","policy":{"access":{"roleCategories":["admin"]},…,"setupRedirectTo":"/admin/setup"}},
  {"kind":"guard","file":"src/app/guard.ts","policy":{"access":"public"}}]}
```

- `path`: route group `(x)` と `@slot` を落とした URL。動的セグメント（`[slug]`）と intercepting の印（`(.)x`）はそのまま。`slot`: `@slot` の中のページは `"@x"`（親ページと別の行）、それ以外は null
- `state`: `verified` だけ（鎖を字面で辿れた）。`gatedOff`: feature-gate の無効な規則に当たるなら最初のパターン（proxy で 404）、無ければ null。止めたページも鎖は verified 必須（フラグを戻せば即公開されるため）。フラグを変えたら作り直す
- `chain`: 段の並び = page.tsx → 採用 Screen（1 行スイッチの先）→ 同じルートの loader → 最寄りの guard.ts → extend の親 → root（`defineRootGuard`）。親子は AND
  - loader の `access` = `createLoader({ access })` の字面。管理画面の共通部品の組（`adminListParts("sample")` 等）は `{"registry":"sample.search"}`（serviceRegistry の entry から操作ごとに解く）。自前の load を書く loader も `access: <組>.access` なら同じ値に読む（同じファイルで 1 回だけ `const x = adminListParts("sample")` と束ねた `x.access`、またはインラインの `adminListParts("sample").access`
    - 組の関数は `@/wiring/adminScreenParts` から import、domain は文字列の字面）。access を手書きの字面にすると domain の access が変わっても追随しないので、組を使う loader はこちらにする。`allowStatuses` は書いたときだけ（字面で読めない値は `{"expr":"USER_STATUSES"}`）
  - guard の `policy` = `defineRootGuard({…})` / 親の `extend({…})` の字面（`access`・`allowStatuses`・`redirectTo`・`forbiddenRedirectTo`・`returnBack`・`statusRedirects`・`setupRedirectTo` の順）
- 生成失敗（`pnpm generate routes` が非 0、行と理由）: page.tsx から Screen を解決できない / Screen が同じルートの loader を import して本体の最上位（最初の `return` より前）で await しない（`pnpm test src/lib/screens/screens.test.mjs` も同じ解析で検査）/ loader が最寄りの guard.ts の `createLoader` を使わない / access・方針・extend の親が字面で読めない / guard.ts の範囲の layout（とスイッチ先）が `authGuard` 等の旧ガードを直接呼ぶ / public でない guard.ts の隣の layout が `guard()` を呼ばない
- 解析は `checks.mjs`（`checkScreenLoaderCall`・`parseLoaderGuard`・`parseGuardFile`・`layoutCallsGuard`・`parseLiteral`）で、地図と `pnpm test src/lib/screens/screens.test.mjs` が共有する
- 既知の限界: 字面だけを読む。import の別名（`createLoader as x`）・変数に入れた方針・スプレッドは読めない（生成失敗になる）。組の access も上の 2 形だけ: 分割代入・別ファイルから import した組・let / var・名前の再宣言や再代入・`.access` の先まで辿る式は生成失敗（`pnpm test src/lib/screens/checks.test.mjs`）。Screen の `return` の後（JSX の中）の await は数えない
- 地図は生成物: merge で衝突した時の解き方は `pnpm generate routes` での作り直し

