# scripts/codemods

上流の変更に合わせて fork のコードを機械的に書き換える道具。各道具は fork のリポのルートで走らせ、何度走らせても同じ結果になる。テスト: `pnpm test:codemods`。

| 道具 | すること |
|---|---|
| `fork-name-markers.mjs` | 受け口のファイル名から fork の名前の印を外す(共有の棚の印の移行。下) |
| `feature-gate-relocate.mjs` | 門番の規則・常時実行の例外を src/featureGate/ へ移し、旧い置き場の import を直す(下) |
| `guarded-router.mjs` | next/navigation の `useRouter` を守り付きの router(`@/lib/unsavedGuard`、棚は `useShelfRouter`)へ移す(下) |
| `frame-declarations.mjs` | 枠の部位の出し入れ(Hide*・fill・枠の設定の 4 つ)を枠の宣言 `frame.ts` へ移す(共有の棚の枠の宣言の移行。下) |
| `feature-gate-s3.mjs` | 門番の区切り gate-s3: 依存の検査の違反のうち今開いている機能を `required/` に書き出し、cron の route.ts の import を `@/wiring/cronRoute` へ(下) |
| `admin-header.mjs` | 管理のヘッダーの題・クーポンのタブを AdminPage の props へ移し、ほかの差し込み(portal など)を止める一覧に出す(下) |
| `crud-entry-split.mjs` | ボタンの import を `@/lib/crud/components` へ振り分ける |
| `domain-display-buttons.mjs` | ボタンの `domain="<名前>"` を表示用の写し `domain={<名前>Display}` へ置き換える |
| `domain-json-client-display.mjs` | client のコードの domain.json の import を写し `entities/display.ts` の `domainDisplay` へ置き換える |
| `wiring-domains-split.mjs` | `@/wiring/domains` の import を `@/wiring/domainRegistry` と `@/wiring/adminScreenParts` へ振り分ける |

1 つの道具 = 1 つの変更の持ち分。道具はほかの道具を呼ばない(順番は下の「共有の棚の道具の順番」と notice の手順が示す)。

## 共有の棚の道具の順番(計画書 01〜03)

notice の区切りごとに、その区切りの道具を取り込みの後に走らせる(前の区切りの道具を先に。写しでの数え方も同じ順):

1. `fork-name-markers.mjs` — 印の移行の区切り
2. `frame-declarations.mjs` — 枠の宣言の区切り
3. `admin-header.mjs` — 管理ヘッダーの帯の区切り(題・クーポンのタブを機械で移す。止めた物は期限 portal)
4. `admin-header.mjs` — portal の区切り(もう一度走らせる。止めた物は期限 今 = 直すまで型の検査が落ちる)
5. `guarded-router.mjs` — 未保存の守りの区切り(useRouter の import 元。admin-header とは触る所が違うので 3・4 との前後は問わない)

## 門番の区切り gate-s3(feature-gate-s3.mjs)

gate-s3 から依存の検査は fork でも落ちる(gate-s2 の間は表示だけだった)。fork の既存コードが閉じられる機能のフォルダを確かめずに読んでいる所を、この道具で片付ける。門番の道具を読むので tsx で走らせる。

```sh
npx tsx --import ./scripts/test/serverOnlyStub.mjs scripts/codemods/feature-gate-s3.mjs            # dry-run(既定): 書く物・手で直す物の一覧
npx tsx --import ./scripts/test/serverOnlyStub.mjs scripts/codemods/feature-gate-s3.mjs --apply    # 書く → pnpm extensions:generate
#   --no-generate(最後の extensions:generate を省く) | --json(機械向けの出力)
```

- 違反(例外を除く。上流の縮む表 `src/featureGate/checks/dependencyDebt.mjs` がある古い版ではその行も除く。表の無い版でも同じ結果: 表の行だった上流の箇所は requires・gate で通る)の規則が今開いている(fork の config の今の値で `enabled()` が true)→ `src/featureGate/required/<規則>.ts` を書く(reason は「codemod が書いた・要見直し」。本当に必須か見直す: 閉じうるなら消して requires・`gate.enabled("<規則>")` で確かめる)。既にある `required/` は触らない
- 違反の規則が今閉じている → 書かない(閉じた機能を確かめずに読んでいる = 本当の閉じ漏れ)。一覧に出すので手で直す
- cron の `src/app/api/cron/<名>/route.ts` の `@/lib/cron` からの `createCronTaskRoute` → `@/wiring/cronRoute`(他の名前は残す)。`createCronRoute`(手書きの handler)は wiring に口が無いので止めて一覧に出す(`createCronTaskRoute` + `task.ts` に直す)
- 手で直す物が残っていれば `--apply` の後に exit 2

手順: 上流を取り込む(gate-s1・gate-s2 の後)→ dry-run → 閉じた機能の違反と止めた物を片付ける → `--apply` → `pnpm typecheck`・`pnpm ownership:check`・`pnpm test:feature-gate` を通してコミット。

## 門番の置き場を移す(feature-gate-relocate.mjs)

門番(機能を閉じる仕組み)は src 直下の基盤 `src/featureGate/` になった。上流の規則は取り込みで移るので、fork が足した物をこの道具で移す。

```sh
node scripts/codemods/feature-gate-relocate.mjs              # dry-run(既定): 移動・書き換え・止めた物の一覧
node scripts/codemods/feature-gate-relocate.mjs --apply      # git mv・書き換え → pnpm extensions:generate
```

- 規則 `src/proxies/featureGateRules/<名前>.ts`(フォルダ形も)→ `src/featureGate/rules/`、型の import `"../types"` → `"@/featureGate"`(取り込みで先に新しい置き場へ来た規則も import だけ直す)
- 常時実行の例外 `scripts/proxies/alwaysOnExceptions/<名前>.mjs` → `src/featureGate/alwaysOnExceptions/<名前>.ts`(型 `AlwaysOnException` を付ける。名前は英字始まりの英数字だけ)
- fork のコードの import: `proxies/pathPattern.mjs` → `lib/pathPattern/index.mjs`、生成一覧 `proxies/extensions/featureGateRules` の `{ featureGateRules }` → `featureGate/node` の `{ rules as featureGateRules }`
- 止める(書き換えない): 印付きの名前(先に fork-name-markers)・上流と同名の規則(案 `<名前>Fork`)・ハイフンの例外名(案 camelCase)・例外に exception も registry も無い・生成一覧を名前空間などで読む形
- アプリ側(proxy・loader など)で規則の一覧を読んでいた所は書き換えた上で「手で直す」と出す: `@/featureGate/node` は scripts とテストだけ(lint feature-gate-entries)なので `gate.path` / `gate.enabled` に直す

手順: 上流を取り込む → dry-run → 止めた物を片付ける → `--apply` → `pnpm typecheck`・`pnpm ownership:check`・`pnpm test:feature-gate` を通してコミット。旧い型 `@/proxies/types` の `FeatureGateRule`・`GatedFeatureRule` の再 export は区切り gate-s3 で消した(この道具が型の import を `@/featureGate` へ直す)。

## fork の名前の印を外す(fork-name-markers.mjs)

受け口のファイル名は fork の名前の印を持たない(印なしの名前・丸ごと置き換え `<名前>.replace`・一部の上書き `<対象>.override`、D136・D137)。印つきのファイル(`x.<fork の名前>.ts` のような名前)は上流の生成器と検査が止めるので、この道具で移す。

```sh
node scripts/codemods/fork-name-markers.mjs              # dry-run(既定): 変更の一覧と止めた物の一覧
node scripts/codemods/fork-name-markers.mjs --apply      # 改名(git mv)・import の書き換え・常時実行の例外の分割 → pnpm extensions:generate
#   --base <rev>    基準の版(既定 = 自分の台帳 .notices/applied/<fork_id>.md の最後の upstream:<sha>)
#   --no-generate   最後の extensions:generate を省く
#   --json          機械向けの出力
```

印 = 点つきの名前のうち `.default` / `.replace` / `.override` / `.client` / `.test` 以外の語(`src/lib/forkOwnership/dottedNames.mjs`)。自分の `fork_id` でも、親(中間 Tier)の名前でも、`fork_id` と食い違った語でも拾う。触るのは受け口の場所だけ(`x.config.ts` のような普通の点つきの名前は場所の外なので触らない):

| 場所 | 移し方 |
|---|---|
| 拡張点の受け口のフォルダの直下(ファイル・フォルダ形) | 印を外す(`mine.acme.ts` → `mine.ts`、`walletAdjust.acme/` → `walletAdjust/`) |
| `<名前>.default` の隣の `<名前>.<印>`(1 行スイッチの fork の実装) | `<名前>.replace.ts(x)`。スイッチの 1 行は import の書き換えで追従 |
| `src/app` の `_layout` / `_screen` の下 | 隣に置き換える既定(`<名前>.ts(x)` か `<名前>/index.ts(x)`)があれば `<名前>.replace`(枠の layout.tsx の 1 行も追従)、無ければ fork だけの部品として印を外す |
| `scripts/tasks`・`src/wiring` の直下 | 印を外す(`client` の中置きは残す: `X.client.acme.tsx` → `X.client.tsx`) |
| `scripts/proxies/alwaysOnExceptions.<印>.mjs` | 行ごとに `scripts/proxies/alwaysOnExceptions/<名前>.mjs`(`export const exception` か `registry`)へ分ける。行のパスも改名に追従 |
| `src/**/extensionPoints.<印>.ts` | 止める(機械では移せない。fork 自身のフォルダの `extensionPoints.ts` へ点と受け口のフォルダを移す) |

- lint の強さ: `_layout` の下で印を外した fork だけの部品(上流の既定の隣に無いもの)は、そのままだと上流の部品と同じ強さ(`style-tokens/no-raw-palette`・`span-in-heading`・`client-service-boundary/no-direct-import` が error)の対象に入る。印つきのころは上流の強さのブロックから外れていたので、`eslint.config.fork.mjs` の `const forkConfig = [` の直後(配列の先頭)に、そのファイルを今の強さ(no-raw-palette off・ほか warn)へ戻すブロックを足す(無ければファイルを作る。何度当てても同じ。足す行は dry-run と --apply の出力に出る)。先頭なので、その下の fork 自身の規則(boardgame-site の app/ の色の検査など)はそのまま効く。上流が持ち主で lint の強さを決めるようになったら、このブロックは消してよい(別の指令)
- import の書き換え: `src`・`scripts` のコード(.ts / .tsx / .mts / .mjs / .js)の `@/…` と相対の指定で、改名したファイル・フォルダを指すものを新しい名前にする。JSON・Markdown の中のパスの字面は書き換えない
- 衝突(止める): 印を外した名前の単位(拡張子と末尾の `/index` を除いた名前)が、基準の版のファイル・ほかの HEAD のファイル・ほかの移行先と同じ。書き換えず、改名の案(項目 = `<名前><印の Pascal>`、タスク = `<名前>-<印>`)を出す。案は決まった規則で作るので、中間 Tier と下の Tier で同じ名前になる

### fork の手順

1. 上流のこの版(印をやめた版)を `/flux` で取り込む(上流の生成器・検査が新しくなる。生成器は印つきの名前で止まる)
2. dry-run: `node scripts/codemods/fork-name-markers.mjs` で変更の一覧と止めた物の一覧を見る
3. 止めた物を片付ける: 衝突は案(か別の名前)に手で改名し、改名した名前を使う import も直す。`extensionPoints.<印>.ts` は fork 自身のフォルダへ移す
4. `--apply`: 改名・import・常時実行の例外の分割と `eslint.config.fork.mjs` の強さのブロック(上)を足して、`pnpm extensions:generate` が一覧と受け口の一覧(`intake.txt` の生成区画)を作り直す
5. `pnpm extensions:check`・`pnpm test:screens`・`pnpm test:wiring`・`pnpm tsc --noEmit` を通してコミットし、`pnpm ownership:check`(上流と同じ単位名は unit-clash、自分の項目への override は override-own)
6. 多段の Tier: **中間 Tier が先に移してから**下の Tier が取り込む。下の Tier が受け継いだ中間 Tier の印つきのファイルは、中間 Tier の移行と同じ名前になるので、中間 Tier の版を取り込めば改名が揃う(下の Tier が自分で足した印つきのファイルは、取り込みの後にこの道具で移す)

確かめ(使い捨ての写し、2026-11-03): oripa-do 印つき 90 → 変更 87(フォルダ 1 件 = 4 ファイル)・止め 0、boardgame-site 26 → 変更 25・止め 1(`README.bodolist.md` が上流の `README.md` と同じ単位)、pandora(oripa-do の下)80 → 変更 77・止め 0(oripa-do から受け継いだ 67 件は oripa-do の移行と同じ名前)。`--apply` の後、上流の走査(生成器の旧い印・スイッチ・tasks・wiring・screens の点つきの名前)は旧い印 0。lint の強さのブロック: oripa-do 1・boardgame-site 9・pandora 1 件を足し、`eslint --print-config` で no-raw-palette off・span-in-heading / client-service-boundary warn(boardgame-site は自分の規則で no-raw-palette error のまま = 今と同じ)、上流の既定の部品は error のまま。

## 枠の宣言へ移す(frame-declarations.mjs)

枠の部位の出し入れは、ルートの隣の宣言 `frame.ts`(`{ layout?, page? }`、上流の既定 `frame.default.ts` の上に重なる)だけで決める。旧い仕組み(`Hide*` の部品・`UserPage` の `fill` / `immersive`・`AdminPage` の `fill`・枠の設定の `BOTTOM_NAV_ENABLED` / `BOTTOM_NAV_VISIBILITY` / `HEADER_ENABLED` / `HEADER_NAV_ENABLED`)は上流から消えたので、この道具で移す。宣言の書き方: `src/app/_layout/frame/README.md`。

```sh
node scripts/codemods/frame-declarations.mjs              # dry-run(既定): 変更の一覧と止めた物の一覧
node scripts/codemods/frame-declarations.mjs --apply      # frame.ts を書き、タグ・属性・使われなくなった import を消す → 生成器の検査を掛ける
#   --base <rev>    基準の版(既定 = 自分の台帳 .notices/applied/<fork_id>.md の最後の upstream:<sha>)
#   --json          機械向けの出力
```

触るのは fork が足したファイルだけ(基準の版にあるファイル = 上流の物は取り込みで移る)。書くのはいつも `frame.ts`(上流のルートの隣でも自分のルートでも。`frame.default.ts` は書かない。既にある `frame.ts` には部位と端末ごとに足す):

| 旧い形 | 移し方 |
|---|---|
| `page.tsx` の中の自己閉じの `<HideFooter />` など(`sp` / `pc` 指定つき、なし = 両方、`={false}` = 何もしない) | 同じフォルダの `frame.ts` の `page:` の `hide`、タグと import を消す |
| `layout.tsx` の中の `Hide*` | 同じフォルダの `frame.ts` の `layout:` |
| `<ルート>/_screen/` か `_components/` の `<名前>Screen.tsx` の中の `Hide*` | そのルート(page.tsx のあるフォルダ)の `frame.ts` の `page:` |
| `<UserPage fill>` / `<AdminPage fill>`(ルートの Screen の中) | そのルートの `frame.ts` の `page: { fill: true }`、属性を消す(管理の枠の下は `AdminFrameDeclaration`) |
| 枠の設定の 4 つの値が上流の旧い既定(ボトムナビ = スマホだけ・ヘッダーとナビ = 両方)と違う | `src/app/(user)/frame.ts` の `layout:`(設定の行は書き換えない。上流はもう読まないので手で消してよい) |

止める(書き換えず一覧に出す。手で直す):

- 子を持つ・条件の中の・`sp` / `pc` 以外か式の props の `Hide*`
- Screen でない部品(`_components/` の部品・`_layout/` の部品・`src/features`・`src/components`)の中の `Hide*` と `fill`: 使うページか layout が決まらないので、使う側の `frame.ts` に書く(部品を使うページが 1 つなら `page:`、layout が包むなら `layout:`)
- `<UserPage immersive>`: 意味が 1 つに決まらない(`page:` の `fill` と隠す部位を `frame.ts` に書き、`safeArea` などの見た目は部品へ)
- `fill={式}`、管理の枠の下の `Hide*`
- 消えた API の読み手: `useBottomNavItems().enabled`・`useHeaderData().enabled` / `navEnabled`・枠の設定の 4 つの import(出し入れは宣言に任せ、読み手を消す)
- 読めない(旧い形の)`frame.ts`: そのファイルへ足す分は書かず、そのタグも残す

部品の中で止めた物(Screen でない部品・ルートの外の `Hide*` と `fill`、`immersive`)は、その部品を描くルートを止める理由に名指す(src のファイルの import を逆にたどり、ルートの page.tsx / layout.tsx / Screen で止まる。`描くルート: <ルート>/frame.ts の page:`)。たどれなければ「描くルートが見つからない」と出す。

差し替えた枠の部品(ヘッダー・フッター・ボトムナビなどを fork が自分の部品にした物)は、外側の要素に `data-slot="<部位>"`(`header` / `header-nav` / `footer` / `bottom-nav`、管理の枠は `admin-header` / `admin-sidebar` / `admin-footer`)を付ければ隠す宣言に従う(部位の名前: `src/app/_layout/frame/parts.mjs`)。

### fork の手順

1. 上流のこの版(枠の宣言の版)を `/flux` で取り込む(上流のファイルの `Hide*` と設定の 4 つは取り込みで消える)
2. dry-run: `node scripts/codemods/frame-declarations.mjs` で変更の一覧と止めた物の一覧を見る
3. 止めた物を手で直す(上の一覧。使う側の `frame.ts` に書き、タグ・読み手を消す)
4. `--apply`: `frame.ts` を書き、タグ・属性・import を消し、書いた結果に生成器の検査(`scripts/extensions/frames.mjs`)を掛ける(問題があれば exit 1)
5. `pnpm extensions:generate`(枠の表を作り直す)→ `pnpm typecheck` → `pnpm lint`(消したタグの跡の空行は整形で消える)
6. CSS: 枠の部位の id(`#header-shell`・`[data-user-app-container]`・`#page-title` など)を狙う fork の規則は `[data-slot="<名前>"]` へ移す(写し先の表は notice。id は移し終えるまで上流に残る。道具は CSS を書き換えない)
7. 差し替えた枠の部品に `data-slot` を付ける(上)。`pnpm ownership:check`(親のルートの隣に `frame.default.ts` を足す・親の既定を書き換えるのは default-add / default-edit。fork は `frame.ts` に書く)

確かめ(使い捨ての写し、2026-11-04): boardgame-site `Hide*` 15 → 変更 12・止め 3(`_layout` の部品)+ 消えた API の読み手 3、oripa-do `Hide*` 40 → 変更 16・止め 24(`src/features`・`src/components`・`_components` の部品)+ `AdminPage fill` 8 → 変更 8 + `HEADER_NAV_ENABLED` の sp → `(user)/frame.ts` + 読み手 1、next-vnx `Hide*` 1 → 変更 1 + `HEADER_ENABLED = false` → `(user)/frame.ts`、88-base `UserPage immersive` 1 → 止め。`--apply` の後、fork のファイルで旧い部品を import するのは止めた物だけ、書いた `frame.ts` は生成器の検査で問題 0。

## 守り付きの router へ移す(guarded-router.mjs)

移動は未保存の編集の守り付きの router を使う(`import { useRouter } from "@/lib/unsavedGuard"`、next/navigation と同じ名前・同じ形。仕組み: `src/lib/unsavedGuard/README.md`)。lint `import-boundaries/router-via-guard` が next/navigation の `useRouter` を止める(上流 error・fork warn、例外は守りの lib の中だけ)。

```sh
node scripts/codemods/guarded-router.mjs            # dry-run(既定): 書き換えるファイルの一覧
node scripts/codemods/guarded-router.mjs --apply    # 書き換える
#   --json  機械向けの出力
```

- `import { useRouter } from "next/navigation"` から `useRouter` だけを外して `import { useRouter } from "@/lib/unsavedGuard"` を足す(ほかの名前は next/navigation に残す、別名も保つ)。呼び出しの書き方は変えない
- 棚(`src/components`)は lib を読まない(D50)ので、棚の Navigation の口の `useShelfRouter` を同じ名前で読む(`import { useShelfRouter as useRouter } from "@/components/Navigation/NavigationPort"`)
- 触らない: 守りの lib の中・テスト・型だけの import。何度当てても同じ

### fork の手順

1. 上流のこの版(守りの lib の版)を `/flux` で取り込む(上流のファイルは取り込みで移る)
2. dry-run → `--apply` で fork のファイルを移す
3. `pnpm typecheck` → `pnpm lint`(`router-via-guard` の残りが 0)
4. 編集画面を AppForm で組んでいなければ、その画面で `useUnsavedGuard(isDirty)` を呼ぶ(AppForm は既定で守る。切るなら `guardUnsaved={false}`)。自作の守り(beforeunload・popstate の自前の処理)は外す

## 管理ヘッダーへ移す(admin-header.mjs)

管理のページのヘッダーの中身は、ページが `<AdminPage title="…" center={…} actions={…}>` の props で渡す(外から差し込む仕組みは消えた。D134・D135。形: `src/app/admin/_layout/README.md`)。この道具は機械で決まる物だけを書き換え、ほかは止める一覧に出す。

```sh
node scripts/codemods/admin-header.mjs              # dry-run(既定): 変更の一覧と止めた物の一覧
node scripts/codemods/admin-header.mjs --apply      # 書き換える
#   --base <rev>      台帳の版(既定 = 自分の台帳 .notices/applied/<fork_id>.md の最後の upstream:<sha>)
#   --upstream <rev>  取り込んだ上流の版(既定 = HEAD と upstream/main の merge-base = 取り込んだ最後の上流の commit)
#   --json            機械向けの出力 { base, upstream, checkpoint, mode, changes: [{ path, line, kind, detail }], stops: [{ path, line, kind, target, due, detail }], notes }
```

- 触るのは fork が足したファイルだけ = 台帳の版にも取り込んだ上流の版にも無いファイル(上流の物は取り込みで移る)。台帳の版だけだと、台帳の後に上流が足したファイル(帯の区切りの `AdminHeader.tsx` など)を fork の物と取り違える。取り込んだ上流の版が分からない(`upstream/main` が無く `--upstream` も無い)ときは台帳の版だけで決め、`notes` に出す。テスト・守りの lib の中は見ない
- 区切りは取り込んだ後のツリーで決める(台帳は fork のファイルを決めるだけ): `src/app/admin/_layout/AdminPageTitle.tsx` が無い = 帯の版をまだ取り込んでいない(exit 2)/ 互換の `AdminHeaderPortal.tsx` が残っている = 帯の区切り(止めた物の `due` は `portal`)/ 消えた = portal の区切り(`due` は `now`)。`ItemNavigator` の消えた props(`usePortal` / `slot` / `onBeforeNavigate`)は帯の区切りで消えたので、どちらの区切りでも `due: now`

機械で書き換える(どちらの区切りでも):

| 旧い形 | 移し方 |
|---|---|
| AdminPage の最初の子(か、最初の子の `<Stack>` の最初の子)の `<PageTitle>`(`placement` 無し / `"header"`、ほかの props 無し、子は文字か `{式}` 1 つ)、AdminPage に title が無い | `<AdminPage title="…">`(式なら `title={式}`)、PageTitle と使われなくなった import を消す |
| AdminPage の直接の子の `<CouponSectionTabs placement="header" />`(ほかの props 無し)、AdminPage に center が無い | `<AdminPage center={<CouponSectionTabs variant="header" />}>` |

止める(書き換えず一覧に出す。種類は道具の `STOP_KINDS` の閉じた一覧、`target` = 移し先):

| 種類 | 見つける物 | 移し先 |
|---|---|---|
| `portal-title` / `portal-center` / `portal-right` | `<AdminHeaderPortal slot="title" / "center" / "right">`(式の slot は center) | AdminPage の `title` / `center` / `actions`。`src/features` の部品の中から差していたら、その部分を部品の外へ出して route の Screen が組む |
| `page-title-in-body` | 機械で移せない PageTitle(`placement="page"`・最初の子でない・ほかの props・子が部品・AdminPage に title がある・AdminPage の外) | ページの題なら AdminPage の `title`、本文の見出しなら `SecTitle` など |
| `coupon-tabs-placement` | 機械で移せない `CouponSectionTabs placement`(AdminPage に center がある・ほかの props・直接の子でない) | `center={<CouponSectionTabs variant="header" />}` |
| `item-navigator` | `useItemNavigator(…)`、`ItemNavigator` の `usePortal` / `slot` / `onBeforeNavigate` | `actions={<AdminEditItemNavigator domain={domainDisplay} current={record} />}`、または `ItemNavigator` + `useDomainItemNavigation`(移るだけ)。domain.json の `generate` が true のドメインは `pnpm dc:generate <Domain>` が Edit*Form と編集の Screen を作り直す |
| `admin-layout-header-prop` | `<AdminLayout header={…}>`、`_layout/HeaderSlots`・`_layout/Header`・`_layout/AdminHeaderContext` の import | `src/app/admin/_layout/AdminHeader.replace.tsx` + `AdminHeader.tsx` の 1 行を向ける |
| `slot-id-css` | `admin-header-{title,center,right}-slot`・`ADMIN_HEADER_*_SLOT_ID`(CSS・スクリプト) | `[data-slot="admin-header-title" / "-center" / "-right"]` |
| `own-unsaved-guard` | 自前の `beforeunload`、`use…Unsaved…Guard` の定義・守りの lib 以外からの import | `@/lib/unsavedGuard`(`useUnsavedGuard(isDirty)`、AppForm は既定で守る) |
| `page-without-admin-page` | AdminPage を描かない管理の Screen(`src/app/admin/**/_screen/**/<名前>Screen.tsx` か `_components/` の下、`src/lib/screens/checks.mjs` の `checkAdminPageScreen`) | AdminPage で包む。子の部品(`src/features`・`_components`)の中で描いていたら AdminPage を Screen へ上げる。転送だけの Screen は `return <AdminPage title="…" />`(上流の settings の入口と同じ)。ヘッダーを出さないページは隣の `frame.ts` で隠す |

見つけ方はファイルごとの名前と import(別名は追う。fork の入口から読み直した物は見つからないことがある = typecheck が残りを知らせる)。

### fork の手順

1. 上流の帯の版を `/flux` で取り込む → dry-run(`due: portal` の一覧を見る。上流のリモートが `upstream` でなければ `--upstream <取り込んだ上流の rev>`)→ `--apply` → `pnpm typecheck` → `pnpm lint`
2. 止めた物は portal の区切りまでに直す(帯の区切りでは互換がまだ動く)。`--json` の `stops` は /flux の手作業の一覧にそのまま貼れる
3. 上流の portal の版を取り込む → もう一度走らせる(`due: now` = 直すまで型の検査が落ちる)→ 止めた物を直す → `pnpm typecheck` → `pnpm lint` → `pnpm routes:map`(AdminPage を描かない管理のページは地図でも止まる)
4. useRouter の import 元は `guarded-router.mjs`(上の順番)
