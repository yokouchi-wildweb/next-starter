# scripts/structure/lib-package — 閉じたかの検査(宣言した lib の単体の型検査・sideEffects・設定・自前の合成)

lib ごとの「閉じたか」を確かめます。`package.json` を持つ lib(= 宣言した lib)は下の 1〜5 の不備で落ち、宣言の無い lib は数えて一覧に出すだけで落としません(L1.21。error にするのは最後の段)。package.json の形そのもの(exports・libs・peers・sideEffects の書き方)は `src/lib/libPackage`(読み手と形の検査)と lint が見ます。形に問題がある lib はここでは飛ばして名前を出します(state skipped)。

```
pnpm check lib-package               # 不備の行 + 1 行のまとめ(門 build・ship でも回る)
pnpm check lib-package -- --list     # lib ごとの表(外から中を読む import の数も)
pnpm check lib-package -- --json     # 同じものを JSON で({ rows, summary }、指令 27・クエスト向け)
pnpm check lib-package -- codemod …  # 動き: 中を読む import を入口へ書き換える(下の「動き」)
pnpm check lib-package -- moved …    # 動き: notice の moved: と imports: の表(下の「動き」)
pnpm check lib-package -- help       # 使い方
pnpm test scripts/structure/lib-package
```

- exit 0 = 宣言した lib に不備 0(package.json を持つ lib が 0 の時も)/ 1 = 不備あり(直す所を 1 行ずつ出す)/ 2 = 引数の誤り
- `--` の後の最初の語が動き(action)。語が無ければ門の検査(scripts/structure/routes の `-- show` と同じ形)。動きの exit はその動きの物

## 動き(action)

どちらも lib の名前を持たず、作業ツリーで閉じた lib(package.json を持ち形に問題の無い lib)の宣言から求めます。閉じた lib が増えれば同じ道具がそのまま使え、fork は自分の木で回します。

### codemod — 中を読む import を入口へ書き換える

```
pnpm check lib-package -- codemod [--apply] [--json] …
```

- 閉じた lib の中のファイルを読む import を、その名前を出す入口(package.json の exports、re-export を辿る)に書き換える。既定は dry-run(書かない)、`--apply` で書く、`--json` で機械向け
- 書き換えない物は止まる一覧に種類つきで出す(入口から出ていない名前・default / 名前空間 / 副作用 / 動的な import)
- 本体と引数の詳細: `codemod.mjs`(`-- codemod --help`)

### moved — notice の moved: と imports: の表

```
pnpm check lib-package -- moved --base <rev> [--head <rev>] [--json]
```

- `--base` = 付け替えの前の版(例: 閉じる波を始める前の main)、`--head` = 改名を比べる先(既定 HEAD)。宣言は作業ツリーから読む。git から読むので checkout しない
- `moved:` = ファイルの行。`<base>`→`<head>` で git が改名と見た(-M)行のうち、新しいパスが閉じた lib の中で古いパスがその lib の外の物(例 `src/hooks/useIsClient.ts -> src/lib/isClient/useIsClient.ts`)。notice の moved: 欄にそのまま貼る(/flux が fork の編集を移す)
- `imports:` = 指定子の行。`<base>` のソースにある `"@/…"` の指定子を lint と同じ解決(eslint-rules/resolve-import.mjs)で `<base>` のファイルに解き、`<head>` のファイル(同じパスか改名の先)が閉じた lib の入口でない中のファイルなら、それを出す入口(codemod の `entryForFile` と同じ求め方)と組にする(例 `@/hooks/useIsClient -> @/lib/isClient`)。notice の notes: と codemod の手順に使う
- `deleted:` = 指定子の先が `<head>` で消え改名も無い物 / `unresolved:` = 閉じた lib の中のファイルだが、どの入口からも出ていない物。どちらも推し量らずに出す(notes: に書く・入口を足す材料)
- 行にするのは `<base>` で上流が使っていた指定子だけ。fork だけが読む中のパスは fork の木で codemod を回して直す
- `--json` = `{ base, head, moved: [{from,to}], imports: [{from,to,files}], deleted: [{from,file}], unresolved: [{from,file,lib}] }`

## 0. lib ごとの状態(--list / --json)

- `state`: `closed`(宣言・不備 0)| `gaps`(宣言・不備あり)| `skipped`(package.json の形に問題)| `undeclared`(package.json 無し)
- `declared`: `none` | `ok` | `problems:<数>`
- `inner`: 外から lib の中を読む import の数。宣言した lib = exports の入口に当たらない import、宣言の無い lib = lib の根(index)以外に当たる import。lint の lib-entry と同じ部品(eslint-rules/resolve-import.mjs の resolveImport、src/lib/libPackage の libOfPath・findEntry)で判定する。走査 = lint と同じ所(git の追跡 + 未追跡、node_modules・.next・src/_stash 等を除く)、`@lib-config/…` は数えない
  - ここでは数えて見せるだけ。宣言した lib の中を外から読む import を落とすのは pnpm lint の lib-entry(1 つの規則)。だから門の watch にも repo 全体は入れない
- `problems`: 下の 1〜5 の不備の数(宣言した lib だけ)
- `config`: `none`(config.ts 無し)| `ok`(上書き src/config/lib/<名前>.config.ts あり)| `overrideMissing`
- `merge`: 残っている自前の合成の名前(下の 5)

## 1. lib の tsconfig.json(手で書く)

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
- `@lib-config/<自分>` = 常に書く。先(`src/config/lib/<自分>.config.ts`)が無い時は、読んだ時だけ型検査で落ちる(既定値で黙って通さない)。置き場の決まりは指令 24
- 外部のパッケージはルートの node_modules から今までどおり解決する

### @lib-config(設定の届け方の行)

- ルートの tsconfig.json に `"@lib-config/*": ["./src/config/lib/*.config.ts"]` の 1 行(上流が出荷、fork は編集しない)。候補は 1 つだけ
- lib の tsconfig.json の `@lib-config/<自分>` の行は、この 1 行と同じ先を指す(ルートの paths は lib では置き換わるので、自分の行を書く)
- 上書きのファイルが無い lib は、tsc(TS2307)・tsx(pnpm task / scripts の実行)・pnpm test のどれでも解決の失敗で止まる。空の上書き(`export default {};`)を置くと通る。lint の解決(eslint-rules/resolve-import.mjs)も同じ行で解く
- 確かめ: `delivery.test.mjs`(一時フォルダの見本。行は本物の tsconfig.json から写す)。next build・Turbopack は最初の実物の lib(toast)で確かめる

## 2. 単体の型検査

lib の tsconfig.json で型検査します(出力しない)。tsconfig.json が食い違う lib は型検査をしません(先に 1 を直す)。

- 数える: 自分のファイルの診断(宣言の外の `@/lib/x` は TS2307)
- 数えない: 依存の lib・棚・設定のファイルの中の診断(依存はその lib の検査が見る)
- 相対パスで外へ出る import(`../other/x`)は paths では止まらないので、自分のファイルの import を解いて、自分・閉包の lib・棚・設定のファイル・node_modules の外に当たれば落とす

## 3. sideEffects

package.json の `sideEffects` と、lib のファイル(テスト・.d.ts を除く)のモジュール直下の副作用を照らします(D84)。

- 副作用 = 読み込んだだけで起きること: 名前を受け取らない import(`import "./x.css"`)・式の文(呼び出し・代入。先頭の `"use client"` などの指示は除く)・if / for / while / do / switch / try / ブロック / ラベル / throw の文
- 数えない: 宣言(function・class・type・enum・`const x = f()` を含む変数)と export
- `sideEffects: false` → 副作用が 1 つでもあれば落ちる
- `sideEffects: ["<glob>", …]` → 副作用のあるファイルが一覧に当たらなければ落ちる(`/` の無い glob はどの段のファイル名にも当たる。npm と同じ)
- 書いていない → 見ない(副作用ありとして扱われる)。sideEffects は測った所だけ書く(D86)
- 判定は書き方だけで見る: 初期化の式の中に隠れた呼び出し(`export const x = register()`)は拾わない

## 4. 設定の上書き

- lib に `config.ts` があるなら、上書き `src/config/lib/<名前>.config.ts` が要る(無ければ落とす。空の上書きは `export default {};`)。置き方: src/lib/README.md「設定の届け方」

## 5. 自前の合成の残り(L1.23)

閉じた lib は設定の合成を `@/lib/defineConfig` の defineConfig で行います。lib ごとの一覧は持たず、形で見ます。

- 自前の合成 = `@/lib/defineConfig` を読まない lib が、`define<名前>Config` を export する(defineFontsConfig・defineSiteThemeConfig)か、合成器と同じ名前のファイル `defineConfig.<ext>` で `define<名前>` を export する(defineVariantOverrides)
- defineConfig を読んで作る薄い包み(`define<名前>Config = () => defineConfig(…)`)は自前の合成ではない
- 合成器そのもの(契約 api.defineconfig が名指す lib `defineConfig` = `COMPOSER_LIB`)には掛けない
- 設定の合成でない define(crud の defineHiddenColumns など)は当たらない。別の名前の自前の合成は見えない(名前と置き場で見るため)

## ファイル

- `check.mjs` 入口(gate.json の check)。`checkLibs(root)` → `{ checked, skipped, undeclared, problems }`、`libReport(root)` → `{ rows, summary }`(--list / --json)
- `moved.mjs` moved の動き(`movedRows`・`formatMoved`・`runMoved`)
- `codemod.mjs` codemod の動き(`runCodemod`・`entryForFile`)
- `closed.mjs` `libStates`・`closedLibProblems`・`scanInnerImports`・`configStateOf`・`mergeHelpersOf`・`COMPOSER_LIB`
- `standalone.mjs` `closureOf`・`expectedPaths`・`expectedTsconfig`・`compareTsconfig`・`typecheckLib`
- `sideEffects.mjs` `sideEffectsInSource`・`findSideEffects`・`checkSideEffects`
- `libPackage.test.mjs` 一時フォルダの小さな repo でのテスト
- `closed.test.mjs` 閉じたかの検査のテスト
- `moved.test.mjs` moved の動き(一時フォルダの git repo)
- `delivery.test.mjs` @lib-config の 1 行と、上書きが無い時に tsc・tsx・pnpm test が止まること
