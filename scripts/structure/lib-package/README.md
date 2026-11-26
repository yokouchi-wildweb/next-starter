# scripts/structure/lib-package — 閉じたかの検査(宣言した lib の単体の型検査・sideEffects・入口の中身・設定・自前の合成)

## Overview

- lib ごとの「閉じたか」を確かめます。`package.json` を持つ lib(= 宣言した lib)は下の 1〜6 の不備で落ち、宣言の無い lib(package.json の無い `src/lib/<名前>`)は不備 `undeclared` 1 つで落ちます(閉じた lib の検査は掛けない。上流の lib は「lib を閉じる手順」、fork の自前の lib は宣言の道具で package.json を置く)。package.json の形そのもの(exports・libs・peers・sideEffects の書き方。入口の名前 = exports の鍵が `.`・`./server`・`./client`・`./node` の 4 つだけ、ほかは `entryName`)は `src/lib/libPackage`(読み手と形の検査)が見ます。形に問題がある宣言の lib は 1〜6 を飛ばし、閉じていない不備 1 つ(`shape`。理由に形の問題の名前と文を並べる)で落とします(state skipped)。上流の lib にも fork が足した自前の lib にも同じに効きます。今の repo の lib を型検査するのはこの段階だけで、テストは作り物のリポで仕組みを試します(1 回の `/sluice --safe` で同じ型検査を重ねない)。

## Usage

```
pnpm check lib-package               # 不備の行 + 1 行のまとめ(段階 build・ship でも回る)
pnpm check lib-package -- --list     # lib ごとの表(外から中を読む import の数も)
pnpm check lib-package -- --json     # 同じものを JSON で({ rows, summary }、機械向け)
pnpm check lib-package -- jsdoc …    # 動き: JS の lib の暗黙の any に推した型を JSDoc で書く(下の「動き」)
pnpm check lib-package -- declare …  # 動き: 自分の節の宣言の無い lib に package.json と tsconfig.json を書く(下の「動き」)
pnpm check lib-package -- help       # 使い方
pnpm test scripts/structure/lib-package
```

- exit 0 = 宣言した lib に不備 0(package.json を持つ lib が 0 の時も)/ 1 = 不備あり(直す所を 1 行ずつ出す)/ 2 = 引数の誤り
- `--` の後の最初の語が動き(action)。語が無ければ段階の検査(scripts/structure/routes の `-- show` と同じ形)。動きの exit はその動きの物

### 動き(action)

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
- 暗黙の any 以外の型の誤り(TS2339 など)は直さない。それは閉じたかの検査(段階の検査)が名指しする。返り値が `object` になっている所は、typedef を 1 つ書くと読み手の誤りがまとめて消えることが多い
- 単体用 tsconfig は緩めない(下の「lib の tsconfig.json」の形のまま。閉じた .mjs の lib は JSDoc で strict の型検査を通す)
- 祖先の lib(目録 `src/lib/CATALOG.md` の自分以外の節)の中は書かない: `--lib` なしは自分の lib だけ、`--lib` で祖先の lib を名指すと何もせず exit 2(直すなら /order <直接の親>)。Tier1 は先頭の節 = 自分なので全部
- 本体と引数: `jsdoc.mjs`

#### declare — 自分の lib に package.json と tsconfig.json を書く

```
pnpm check lib-package -- declare [<名前>]... [--apply] [--json]
```

- 対象 = `src/lib/CATALOG.md` の自分の節(repo.json の repo_id)にある、package.json の無い lib(名前を書かなければ全部)。宣言の無い lib は段階の検査が `undeclared` で落とすので、fork が自前の lib を閉じる入り口
- 拒む(書かない): 祖先の lib(自分の節に無い。宣言は持ち主が行う → /order <直の親>)・宣言済みの lib・自分の節に行の無い lib
- 推して書く物:
  - `exports`: lib の中のファイルの名前から。`index.*` → `.`、`server.*` / `server/index.*` → `./server`、`client…` → `./client`、`node…` → `./node`(入口の名前は 4 つだけ)
  - `libs` / `peers`: lib のファイル(テストも)の import の先から。`src/lib/<他>` → libs、`src/components` → peers `components`
  - tsconfig.json: その宣言の閉包で、段階の検査が期待する形(下の API「lib の tsconfig.json」)
- 決めきれない所は一覧に出す(書く物は変えない。1 つでもあれば exit 1):
  - `inner`: 外から入口でない中のファイルを読む import。読み手の場所から入口の候補を添える(scripts・eslint-rules・servers → `./node`、services/server・app/api・server の名 → `./server`、ほか → `.`)。読む名前をその入口から出し、読み手を入口に直す
  - `outside`: lib が読めない所(features・app・hooks・utils・`@/config` など)を読む import。引数・注入で受けるか、値なら設定(src/lib/README.md 手順 1・6)
  - `noEntry`: 入口のファイルが 1 つも無い
- 既定は dry-run、`--apply` で書く(tsconfig.json が既にあれば上書き)、`--json` で機械向け `{ apply, plans: [{ lib, status, reason?, packageJson?, tsconfig?, unresolved? }] }`
- fork の順番: 取り込み → `declare`(dry-run で決めきれない所を見て直す → `--apply`)→ 外から中を読む import を入口へ直す(`pnpm lint` の `entry/only-entries` が名指す。`inner` の候補もここで見る)→ `pnpm check lib-package`
- 本体と引数: `declare.mjs`

## API

### lib ごとの状態(--list / --json)

- `state`: `closed`(宣言・不備 0)| `gaps`(宣言・不備あり)| `skipped`(package.json の形に問題)| `undeclared`(package.json 無し。不備 `undeclared` 1 つ)
- `declared`: `none` | `ok` | `problems:<数>`
- `inner`: 外から lib の中を読む import の数。宣言した lib = exports の入口に当たらない import、宣言の無い lib = lib の根(index)以外に当たる import。lint の entry/only-entries と同じ部品(eslint-rules/resolve-import.mjs の resolveImport、src/lib/libPackage の libOfPath・findEntry)で判定する。走査 = lint と同じ所(git の追跡 + 未追跡、node_modules・.next・src/_stash 等を除く)、`@lib-config/…` は数えない
  - ここでは数えて見せるだけ。宣言した lib の中を外から読む import を落とすのは pnpm lint の entry/only-entries(1 つの規則)。だから段階の watch にも repo 全体は入れない
- `problems`: 下の 1〜6 の不備の数(宣言の無い lib は `undeclared` の 1)
- `config`: `none`(config.ts も config.ui.ts も無し)| `ok`(持つ口の上書き src/config/lib/<名前>.config.ts / <名前>.ui.config.ts が全部あり)| `overrideMissing`
- `merge`: 残っている自前の合成の名前(下の 6)

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

検査の 1〜6(宣言した lib が落ちる不備): 1 = 上の API「lib の tsconfig.json」の食い違い、2〜6 = 下。

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

### 4. 入口の中身

入口の名前の意味(D248。src/lib/README.md 手順 4)のうち、ファイルを読めば分かる 2 つを見ます(`entries.mjs`)。

- `entryUseClient`: 入口 `.` のファイルの先頭の指示に `"use client"` がある(入口が client だと、server が入口を通して読む値が全部 client の参照になる。`"use client"` は要る部品のファイルにだけ書く。core/lib.md entry_no_use_client)
- `nodeEntryReact`: 入口 `./node` から値で辿れるファイルが `react`・`react-dom`・`next`(とその下の道)を読む。入口から道(ファイルの並び)を出す
  - 辿る: 静的な import・`export … from`・文字列 1 つの `import()` と `require()`。相対と別名(`@/…`・`@lib-config/…`、lint と同じ解決 eslint-rules/resolve-import.mjs)で解ける `src/` の下のファイルへ(他の lib の入口・棚も)
  - 辿らない: 型だけの import / export(`import type`・`export type`・指定子が全部 `type`)。実行時に残らない
  - 見えない物は通す: 文字列で組み立てる `import()`、外部のパッケージの中で React を引く物

### 5. 設定の上書き

- lib に `config.ts` があるなら、上書き `src/config/lib/<名前>.config.ts` が要る(無ければ落とす。空の上書きは `export default {};`)。置き方: src/lib/README.md「設定の届け方」

### 6. 自前の合成の残り

閉じた lib は設定の合成を `@/lib/defineConfig` の defineConfig で行います。lib ごとの一覧は持たず、形で見ます。

- 自前の合成 = `@/lib/defineConfig` を読まない lib が、`define<名前>Config` を export する(defineFontsConfig)か、合成器と同じ名前のファイル `defineConfig.<ext>` で `define<名前>` を export する(defineVariantOverrides)
- defineConfig を読んで作る薄い包み(`define<名前>Config = () => defineConfig(…)`)は自前の合成ではない
- 合成器そのもの(`src/lib/defineConfig` = `COMPOSER_LIB`)には掛けない
- 設定の合成でない define(crud の defineHiddenColumns など)は当たらない。別の名前の自前の合成は見えない(名前と置き場で見るため)

- 入口 `check.mjs`(phase.json の check)が `checkLibs(root)`(→ `{ checked, skipped, undeclared, problems }`)・`libReport(root)`(→ `{ rows, summary }`)を呼ぶ。部品: `closed.mjs`(状態・中を読む import・設定・合成)・`standalone.mjs`(閉包・tsconfig.json の期待と比べ・型検査)・`configSlots.mjs`(設定の口: 値と描画専用の上書きの置き場と指定子。lint entry/only-entries も読む)・`sideEffects.mjs`・`entries.mjs`(入口の中身)・動きの `declare.mjs`(宣言の道具)・`jsdoc.mjs`

## Verification

- `pnpm test scripts/structure/lib-package`
- `libPackage.test.mjs` 一時フォルダの小さな repo でのテスト(宣言の無い lib が undeclared で落ち、宣言すると消える例。入口の名前: 4 つの名前が通る例・ほかの名前が shape / entryName で落ちる例、入口の中身: entryUseClient・nodeEntryReact・型だけの読みは通ること)
- `closed.test.mjs` 閉じたかの検査のテスト(宣言の無い lib は undeclared 1 つで落ち、閉じた lib の検査は掛けない)
- `jsdoc.test.mjs` jsdoc の動き(一時フォルダの小さな repo)
- `declare.test.mjs` declare の動き(一時フォルダの小さな fork: 自前の lib に package.json と tsconfig.json が書けて検査の undeclared が消える・祖先の lib と宣言済みの lib は拒む・決めきれない所の一覧)
- `delivery.test.mjs` @lib-config の 1 行と、上書きが無い時に tsc・tsx・pnpm test が止まること
