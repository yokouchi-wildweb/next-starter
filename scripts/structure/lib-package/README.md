# scripts/structure/lib-package — 閉じたかの検査(宣言した lib の単体の型検査・sideEffects・設定・自前の合成)

## Overview

- lib ごとの「閉じたか」を確かめます。`package.json` を持つ lib(= 宣言した lib)は下の 1〜5 の不備で落ち、宣言の無い lib は数えて一覧に出すだけで落としません。package.json の形そのもの(exports・libs・peers・sideEffects の書き方)は `src/lib/libPackage`(読み手と形の検査)と lint が見ます。形に問題がある宣言の lib は 1〜5 を飛ばし、閉じていない不備 1 つ(`shape`)で落とします(state skipped)。今の repo の lib を型検査するのはこの門だけで、テストは作り物のリポで仕組みを試します(1 回の `/ship --safe` で同じ型検査を重ねない)。

## Usage

```
pnpm check lib-package               # 不備の行 + 1 行のまとめ(門 build・ship でも回る)
pnpm check lib-package -- --list     # lib ごとの表(外から中を読む import の数も)
pnpm check lib-package -- --json     # 同じものを JSON で({ rows, summary }、機械向け)
pnpm check lib-package -- codemod …  # 動き: 中を読む import を入口へ・出ていった名前を今の入口へ・改名表の改名(下の「動き」)
pnpm check lib-package -- moved …    # 動き: notice の moved: と imports: の表(下の「動き」)
pnpm check lib-package -- jsdoc …    # 動き: JS の lib の暗黙の any に推した型を JSDoc で書く(下の「動き」)
pnpm check lib-package -- help       # 使い方
pnpm test scripts/structure/lib-package
```

- exit 0 = 宣言した lib に不備 0(package.json を持つ lib が 0 の時も)/ 1 = 不備あり(直す所を 1 行ずつ出す)/ 2 = 引数の誤り
- `--` の後の最初の語が動き(action)。語が無ければ門の検査(scripts/structure/routes の `-- show` と同じ形)。動きの exit はその動きの物

### 動き(action)

codemod と moved は lib の名前を持たず、作業ツリーで閉じた lib(package.json を持ち形に問題の無い lib)の宣言から求めます。閉じた lib が増えれば同じ道具がそのまま使え、fork は自分の木で回します。

#### codemod — 中を読む import を入口へ、出ていった名前を今の入口へ、改名表の改名

```
pnpm check lib-package -- codemod [--apply] [--json] …
```

- 閉じた lib の中のファイルを読む import を、その名前を出す入口(package.json の exports、re-export を辿る)に書き換える。既定は dry-run(書かない)、`--apply` で書く、`--json` で機械向け
- 書き換え先の指定子: JS の入口(`.mjs` / `.js`)はファイル名まで書く(`@/lib/pathPattern/index.mjs`。TS はフォルダの index.mjs を解かない)。JS のファイル(素の node で動く道具)が相対で読んでいた物は相対のまま入口へ(素の node は `@/` を解かない)。moved の imports: の行も同じ指定子
- 書き換えない物は止まる一覧に種類つきで出す(入口から出ていない名前・default / 名前空間 / 副作用 / 動的な import)
- 閉じる段で消した束(例 入口 `.` にたたんで消した `@/lib/storage/client`)を読む import: `--base <rev>` なら moved の行の `byName`(束が出していた名前 → 今の入口)で名前ごとに書き換える(入口が分かれれば文を分ける。束が出していなかった名前は止まる)。`--base` なしは `unparsable` で止まり、`--base` の案内を出す
- 名前ごとの割り: 閉じた lib の入口を読む文(`import { a, b } from "@/lib/x"`・`export { a } from "@/lib/x"`)で、その入口がもう出していない名前は、次の順で今それを出す入口を決め、入口ごとの文に分ける(名前が全部入口から出ている文は触らない)
  1. 同じ lib の別の入口の同じ名前(例 `.` から `./server` へ移った名前)
  2. `--base <rev>` があれば、`<base>` の木でその指定子から読んだ名前の実体を引き、git の改名(`<base>` → 作業ツリー)で今のファイルへ辿り、その実体を出す入口(別の lib へ移った名前。同じ名前が別の lib にもある時もこれで分かれる)
  3. その名前を出す閉じた lib の入口が 1 つ(実体が 1 つ)ならそれ(`--base` なしでも。git の改名なしに別のファイルへ移った名前)
  - 決まらなければ `ambiguous`(候補の入口を並べる)、どこにも無ければ `notExported` で止まる。パッケージからの `export *` を持つ入口(名前を数えきれない)を読む文は触らない
  - 中のファイルを読む文も、そのファイルから消えた名前は同じ順で行き先を探す(ファイルに今もある名前は入口から出していないだけなので探さない)
  - 閉じた lib の外の repo のファイル(閉じる前の lib・ドメイン。`src/` と `scripts/` の JS / TS)を読む文も、そのファイルから出ていった名前を同じ順(2・3)で閉じた lib の入口へ向ける。`--base` があれば、今の木に無いファイル(閉じる前の lib から動いた・消えた物)を読む文も名前を全部「出ていった」として探す。行き先の決まらない名前のある文は止めずに見送る(閉じた lib の契約の外。型検査と lint が見る)
- 改名表 `renames.json`: 行 = `{ segment, lib, kind, from, to, receivers?, origin? }`(segment = その行を持ち込んだ区切り / notice。名前を変えた段がその区切りの行を足す)
  - `kind: "export"` = 入口から出す名前の改名。その lib から古い名前を読む import を新しい名前にし、別名の無い import ならファイルの中の参照も書き換える(TypeScript の検査器でその束縛と同じ symbol の識別子だけ。`{ Old }` の短縮は `{ Old: New }`)。`origin` = lib の別の物と同じ名前の時、`<base>` の木で名前の実体が置かれたファイル(例 firestore の `createCrudService`)。`origin` の行は `--base` が要る
  - `kind: "method"` = メソッド名の改名(例 crud のサービスの `remove` → `delete`、ApiClient の `getById` → `get`)。repo の tsconfig.json で TypeScript の program を立て、受け手の型が `src/lib/<lib>/` の中で新しい名前を宣言し、古い名前を自分では持たない時だけ書き換える(= lib を改名した後の木。名前だけでは書き換えない)。`x.old(`・`x["old"]`・`{ old } = x`(→ `{ new: old }`。束縛名は元のまま、`delete` は束縛名にできない)・`{ old: y } = x`。そうした受け手を広げた object literal の中の `old`(ドメインの包みの上書き `{ ...service, old: … }`)も書き換え、その包みを通した呼び出しも追う。同じ名前のメソッドを持つ別の型(Map・DOM の要素など)は触らない
  - 改名の止まる一覧: `needsBase`(origin の行に `--base` が無い)・`renamedReexport`(改名する名前をファイルから出し直している。出す名前を変えると読み手が壊れるので手で決める)・`nameTaken`(新しい名前がファイルに既にある)・`untyped`(受け手の型が any / unknown / 解けない import で、ファイルがその lib を読んでいる。報告だけ)
  - method の program は表に method の行があり、古い名前を含むファイルがある時だけ立てる(repo 全体で数秒〜十数秒)
- fork は notice を取り込んだ後、notice に書かれた上流の sha を `--base` に渡して回す(名前ごとの割り・origin の行・消えた束が `--base` で決まる)
- 出荷済みの notice の道具(`.notices/<id>.*.mjs` とそのテスト)は走査しない(書き換え・止まる一覧・閉じたかの検査の「中を読む」数のどれにも入らない。`closed.mjs` の `scanFiles`)。道具は自分の区切りの時点の木に対して走り、出荷後は書き換えないので、その木で正しい中の道を今の入口へ直さない(lint entry/only-entries も外す)
- 本体と引数の詳細: `codemod.mjs`・`renames.mjs`(`-- codemod --help`)

#### moved — notice の moved: と imports: の表

```
pnpm check lib-package -- moved --base <rev> [--head <rev>] [--json]
```

- `--base` = 付け替えの前の版(例: 閉じる波を始める前の main)、`--head` = 改名を比べる先(既定 HEAD)。宣言は作業ツリーから読む。git から読むので checkout しない
- `moved:` = ファイルの行。`<base>`→`<head>` で git が改名と見た(-M)行のうち、新しいパスが閉じた lib の中で古いパスがその lib の外の物(例 `src/hooks/useIsClient.ts -> src/lib/isClient/useIsClient.ts`)。notice の moved: 欄にそのまま貼る(/flux が fork の編集を移す)
- `imports:` = 指定子の行。`<base>` のソースにある `"@/…"` の指定子を lint と同じ解決(eslint-rules/resolve-import.mjs)で `<base>` のファイルに解き、`<head>` のファイル(同じパスか改名の先)が閉じた lib の入口でない中のファイルなら、それを出す入口(codemod の `entryForFile` と同じ求め方)と組にする(例 `@/hooks/useIsClient -> @/lib/isClient`)。notice の notes: と codemod の手順に使う
- 消えた束: 指定子の先が `<head>` で消え改名も無く、閉じた lib の中の束(相対の `export … from` / `export * from` だけのファイル)なら、`<base>` の版を読んで出していた名前ごとに今それを出す入口を引き、`imports:` の行にする(入口が分かれれば `to` は `, ` で並べる。例 `@/lib/storage/client -> @/lib/storage`)。どの入口からも出ていない名前があれば `unresolved:`
- `deleted:` = 指定子の先が `<head>` で消え改名も無い物(束でない物) / `unresolved:` = 閉じた lib の中のファイルだが、どの入口からも出ていない物。どちらも推し量らずに出す(notes: に書く・入口を足す材料)
- 行にするのは `<base>` で上流が使っていた指定子だけ。fork だけが読む中のパスは fork の木で codemod を回して直す
- `--json` = `{ base, head, moved: [{from,to}], imports: [{from,to,files,byName?}], deleted: [{from,file}], unresolved: [{from,file,lib}] }`

#### jsdoc — JS の lib の暗黙の any に推した型を JSDoc で書く

```
pnpm check lib-package -- jsdoc [--lib <名前>]... [--apply] [--json]
```

- 対象 = package.json と単体用 tsconfig.json を持ち、JS(`.mjs` / `.js`)のファイルを持つ lib(`--lib` で絞る。tsconfig が期待と食い違う lib は飛ばして名前を出す)
- lib の単体用 tsconfig で TypeScript の言語サービスを立て、lib の中の JS ファイルの暗黙の any の診断(TS7006・TS7005・TS7034 など)に codefix inferFromUsage を当てる。使われ方から推した型を JSDoc(`@param`・`@type`・`@returns`)で書く。1 つ書くと次の推しが変わるので、変わらなくなるまで繰り返す。書くのは lib の中のファイルだけ
- 既定は dry-run(lib ごとに暗黙の any の数の前 → 後・ファイルごとの箇所)、`--apply` で書く、`--json` で機械向け
- 推せずに any を含む型を書いた所(欄の any・複数行の型の続きの行も)は `any <ファイル>:<行>` で一覧に出す。人が本当の型に直す(any を残さない)
- 空の配列から推した `never[]` を含む直しは書かず、`never[] <ファイル>:<行> 書かなかった: <JSDoc>` で一覧に出す(行 = 直しを当てる行。人が本当の型を書く)
- 書式(字下げ = 空白 2)を codefix に渡す: 入れ子の関数の複数行の JSDoc も字下げを保つ
- 暗黙の any 以外の型の誤り(TS2339 など)は直さない。それは閉じたかの検査(門の検査)が名指しする。返り値が `object` になっている所は、typedef を 1 つ書くと読み手の誤りがまとめて消えることが多い
- 単体用 tsconfig は緩めない(下の「lib の tsconfig.json」の形のまま。閉じた .mjs の lib は JSDoc で strict の型検査を通す)
- 本体と引数: `jsdoc.mjs`

## API

### lib ごとの状態(--list / --json)

- `state`: `closed`(宣言・不備 0)| `gaps`(宣言・不備あり)| `skipped`(package.json の形に問題)| `undeclared`(package.json 無し)
- `declared`: `none` | `ok` | `problems:<数>`
- `inner`: 外から lib の中を読む import の数。宣言した lib = exports の入口に当たらない import、宣言の無い lib = lib の根(index)以外に当たる import。lint の entry/only-entries と同じ部品(eslint-rules/resolve-import.mjs の resolveImport、src/lib/libPackage の libOfPath・findEntry)で判定する。走査 = lint と同じ所(git の追跡 + 未追跡、node_modules・.next・src/_stash 等を除く)、`@lib-config/…` は数えない
  - ここでは数えて見せるだけ。宣言した lib の中を外から読む import を落とすのは pnpm lint の entry/only-entries(1 つの規則)。だから門の watch にも repo 全体は入れない
- `problems`: 下の 1〜5 の不備の数(宣言した lib だけ)
- `config`: `none`(config.ts も config.ui.ts も無し)| `ok`(持つ口の上書き src/config/lib/<名前>.config.ts / <名前>.ui.config.ts が全部あり)| `overrideMissing`
- `merge`: 残っている自前の合成の名前(下の 5)

### lib の tsconfig.json(手で書く)

宣言した lib は、自分のフォルダに単体用の `tsconfig.json` を持ちます。道具は lib の中に書きません。中身は package.json から決まる 1 通りで、検査は食い違う行を「足す / 消す / 直す」で名指しします(無ければ置く中身を丸ごと出します)。

```json
{
  "extends": "../../../tsconfig.json",
  "compilerOptions": {
    "paths": {
      "@/lib/cn": ["../cn"],
      "@/lib/cn/*": ["../cn/*"],
      "@/components/*": ["../../components/*"],
      "@lib-config/toast": ["../../config/lib/toast.config.ts"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx"]
}
```

- `extends` = ルートの tsconfig.json(コンパイラの設定はそこから引き継ぐ。compilerOptions に書くのは paths だけ。JS を持つ lib は下の 3 つも)
- JS(`.mjs` / `.js`。テストも含む)のファイルを持つ lib は、compilerOptions に `"allowJs": true, "allowImportingTsExtensions": true, "checkJs": true`、include に `"**/*.mjs", "**/*.js"` を足す(`.ts` だけの lib の形は上のまま)
  - JS も飛ばさず型検査する(tsx を通さない Node の道具から読む `.mjs` の lib でも、宣言の外を読めば止める)。型は JSDoc で書く(strict はルートから引き継ぐ)
  - `allowImportingTsExtensions` = node で走る `.mjs`(テストなど)は `.ts` を拡張子つきで読む(`import { x } from "./x.ts"`)。ルートの `noEmit` の下で有効
  - 見本: `src/lib/pathPattern`・`src/lib/libPackage`(`.mjs` だけの lib)、`src/lib/cn`(`.ts` の lib + `.mjs` のテスト)
- `paths` はルートの paths を丸ごと置き換える(`@/*` を引き継がない)。だから宣言していない lib・棚(`@/hooks/*` など)を読むと解決できずに落ちる
- `@/lib/<dep>` と `@/lib/<dep>/*` = package.json の `libs` を辿った閉包(依存の package.json の libs・peers も足す)。package.json に書くのは直接の依存だけで、tsconfig.json には閉包を書く。依存が依存を増やすと、こちらの検査が足す行を出す
- `@/<peer>/*` = `peers` の棚(今は `components` → `src/components`)。閉包の peers も含む
- `@lib-config/<自分>` = 設定 `config.ts`(か `config.tsx`)を持つ lib だけが書く / `@lib-config/<自分>.ui` = 描画専用の `config.ui.ts` を持つ lib だけが書き、`src/config/lib/<自分>.ui.config.ts` を指す。口の決まり(置き場の名前は地区の地図 src/lib/districtMap と同じ)は `configSlots.mjs` の 1 つで、lint `entry/only-entries` も同じ物を読む(無い lib に、無いファイルへの行を残さない。残っていれば検査が消す行を名指しする)。先(`src/config/lib/<自分>.config.ts`)が無い時は、読んだ時だけ型検査で落ちる(既定値で黙って通さない)。config.ts の無い lib が `@lib-config` を読むと行が無いので TS2307 で落ちる。置き場の決まり: src/lib/README.md「設定の届け方」
- 依存も設定も無い lib は paths を書かず、compilerOptions も書かない(JS を持つ lib は上の 3 つだけ)
- 外部のパッケージはルートの node_modules から今までどおり解決する

#### @lib-config(設定の届け方の行)

- ルートの tsconfig.json に `"@lib-config/*": ["./src/config/lib/*.config.ts"]` の 1 行(上流が出荷、fork は編集しない)。候補は 1 つだけ
- lib の tsconfig.json の `@lib-config/<自分>` の行は、この 1 行と同じ先を指す(ルートの paths は lib では置き換わるので、自分の行を書く)
- 上書きのファイルが無い lib は、tsc(TS2307)・tsx(pnpm task / scripts の実行)・pnpm test のどれでも解決の失敗で止まる。空の上書き(`export default {};`)を置くと通る。lint の解決(eslint-rules/resolve-import.mjs)も同じ行で解く
- 確かめ: `delivery.test.mjs`(一時フォルダの見本。行は本物の tsconfig.json から写す)。next build・Turbopack は最初の実物の lib(toast)で確かめる

## Internals

検査の 1〜5(宣言した lib が落ちる不備): 1 = 上の API「lib の tsconfig.json」の食い違い、2〜5 = 下。

### 2. 単体の型検査

lib の tsconfig.json で型検査します(出力しない)。tsconfig.json が食い違う lib は型検査をしません(先に 1 を直す)。

- 数える: 自分のファイルの診断(宣言の外の `@/lib/x` は TS2307)
- 数えない: 依存の lib・棚・設定のファイルの中の診断(依存はその lib の検査が見る)
- 相対パスで外へ出る import(`../other/x`)は paths では止まらないので、自分のファイルの import を解いて、自分・閉包の lib・棚・設定のファイル・node_modules の外に当たれば落とす

### 3. sideEffects

package.json の `sideEffects` と、lib のファイル(テスト・.d.ts を除く)のモジュール直下の副作用を照らします。

- 副作用 = 読み込んだだけで起きること: 名前を受け取らない import(`import "./x.css"`)・式の文(呼び出し・代入。先頭の `"use client"` などの指示は除く)・if / for / while / do / switch / try / ブロック / ラベル / throw の文
- 数えない: 宣言(function・class・type・enum・`const x = f()` を含む変数)と export
- `sideEffects: false` → 副作用が 1 つでもあれば落ちる
- `sideEffects: ["<glob>", …]` → 副作用のあるファイルが一覧に当たらなければ落ちる(`/` の無い glob はどの段のファイル名にも当たる。npm と同じ)
- 書いていない → 見ない(副作用ありとして扱われる)。sideEffects は測った所だけ書く
- 判定は書き方だけで見る: 初期化の式の中に隠れた呼び出し(`export const x = register()`)は拾わない

### 4. 設定の上書き

- lib に `config.ts` があるなら、上書き `src/config/lib/<名前>.config.ts` が要る(無ければ落とす。空の上書きは `export default {};`)。置き方: src/lib/README.md「設定の届け方」

### 5. 自前の合成の残り

閉じた lib は設定の合成を `@/lib/defineConfig` の defineConfig で行います。lib ごとの一覧は持たず、形で見ます。

- 自前の合成 = `@/lib/defineConfig` を読まない lib が、`define<名前>Config` を export する(defineFontsConfig)か、合成器と同じ名前のファイル `defineConfig.<ext>` で `define<名前>` を export する(defineVariantOverrides)
- defineConfig を読んで作る薄い包み(`define<名前>Config = () => defineConfig(…)`)は自前の合成ではない
- 合成器そのもの(`src/lib/defineConfig` = `COMPOSER_LIB`)には掛けない
- 設定の合成でない define(crud の defineHiddenColumns など)は当たらない。別の名前の自前の合成は見えない(名前と置き場で見るため)

- 入口 `check.mjs`(gate.json の check)が `checkLibs(root)`(→ `{ checked, skipped, undeclared, problems }`)・`libReport(root)`(→ `{ rows, summary }`)を呼ぶ。部品: `closed.mjs`(状態・中を読む import・設定・合成)・`standalone.mjs`(閉包・tsconfig.json の期待と比べ・型検査)・`configSlots.mjs`(設定の口: 値と描画専用の上書きの置き場と指定子。lint entry/only-entries も読む)・`sideEffects.mjs`・動きの `moved.mjs` / `codemod.mjs` / `renames.mjs`(改名表 `renames.json`)

## Verification

- `pnpm test scripts/structure/lib-package`
- `libPackage.test.mjs` 一時フォルダの小さな repo でのテスト
- `closed.test.mjs` 閉じたかの検査のテスト
- `moved.test.mjs` moved の動き(一時フォルダの git repo)
- `codemod.test.mjs` codemod の動き(名前ごとの割り・改名表の export / method の行と、別の型の同じ名前を触らないこと)
- `jsdoc.test.mjs` jsdoc の動き(一時フォルダの小さな repo)
- `delivery.test.mjs` @lib-config の 1 行と、上書きが無い時に tsc・tsx・pnpm test が止まること
