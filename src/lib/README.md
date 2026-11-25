# src/lib — ライブラリ

## Overview

- ドメインに属さない、汎用で単体で完結した部品の置き場。どのプロジェクトに持っていっても使えるものを置く（エンティティが要るならドメイン = `src/domains/`）
- **何があるか・誰が作ったかは [CATALOG.md](./CATALOG.md)（目録）を見る。** 新しいユーティリティや基盤を作る前に、目録で同等品が無いか確認する（重複実装の防止）。各ライブラリの詳しい仕様は、そのディレクトリの `README.md`
- lib の 1 つ 1 つは地区(district)の 1 種(ほかはドメイン・枠・proxies。定義と一覧: [districtMap/README.md](./districtMap/README.md)・`src/registry/district-map.jsonl`)。地区は何があり何を持つかの単位で、誰の物か(所有)は下の目録の側

### ライブラリは「パッケージのような単位」

所有はフォルダ（`src/lib`）ではなく、**ライブラリ 1 つずつ**に付く。持ち主 = そのライブラリを作ったリポジトリ（Tier1 の upstream か、fork か）。目録の節がそれを表す。

- **上流のライブラリ**（自分以外の節にあるもの）
  - 公開している入口（`index.ts` などの export）を通して使う。**中身は編集しない・ディレクトリを削除しない**（使わないなら置いたまま。import されなければバンドルに入らない）
  - 挙動を変えたいときは、オプション・設定で変えられるよう上流に依頼する（`/order <上流リポ>`）。急ぎで手を入れたら、名前や引数の形は変えずに修正を上流に返す（CLAUDE.md CORE_FILES `fork_core_edit_compat`）
- **自分のライブラリ**（自分の節にあるもの）: 完全に自分のもの。上流は触らない
- **入口は契約**: 上流は公開 API を改名するとき、自分の呼び手を同じコミットで全部書き換え、古い名前は残さない。fork の呼び手には `.notices` で古い名前 → 新しい名前の表を渡す(機械で置き換えられる物は置き換えの道具を添える)
- **昇格**: fork のライブラリが汎用的だと分かったら上流へ引き上げる（`/order <上流リポ>`）。上流の節に行が入ってきたら、fork は自分の複製と自分の節の行を消す（残っているとテストが「重複」で知らせる）

## Usage

### ライブラリを足すとき

1. `src/lib/<name>/` を作る（名前は camelCase。入口は `index.ts` を推奨）
2. [CATALOG.md](./CATALOG.md) の**自分の節**に `- src/lib/<name> — <一行説明>` を足す。自分の節が無ければ末尾に `## <自分の所有者 ID>` を作る。他の節は編集しない
3. 目録の形は `src/lib/folderCatalog/catalog.test.mjs` が守る(/sluice の検査が回す。作業の中では回さない)

- 所有者 ID = 各リポの名前（リポ直下の `repo.json` の `repo_id`、読み手は `src/lib/forkOwnership/forkIds.mjs`）。origin の URL からは導かない。`.notices/applied/<repo_id>.md` の名前と同じ

### lib を閉じる手順

lib 1 本を「閉じた lib」(package.json の入口だけを外から読み、宣言した物だけを読む)にする手順。1 回の作業 = 1 lib。見本 = `toast`・`isClient`・`frameDims`・`defineConfig`(`git log -- src/lib/toast` で実際の差分を見られる)。各段の確かめは diff と grep で書く。型・lint・テストの検査は手順の中で回さず、出荷の /sluice が回す(落ちたら落ちた所だけを回し直す)。

0. **始める前**: 同じ lib を他の作業(受信箱の依頼・進行中の別の作業)が触っていないか確かめる(受信箱 `~/.local/state/next-starter/orders/<repo-id>/` の依頼に lib の名前が出ないか・進行中の作業の範囲に lib のフォルダが入っていないか)。今の状態を見る: `pnpm check lib-package -- --list`(lib ごとに `closed` / `gaps` / `undeclared`。道具からは `-- --json`)
1. **依存を洗い出す**: lib の中から外を読む import を一覧にし、lib / 棚(`@/components`)/ hooks・utils / `@/config` / features・app に仕分ける。features・app・`@/config` は読めない → 引数・注入で受けるか、値なら手順 6 の設定にする
   - 確かめ: `git grep -nE "from ['\"]@/" -- src/lib/<name>` と、相対で lib の外へ出る `git grep -n "from ['\"]\.\./\.\./" -- src/lib/<name>`
2. **hooks / utils**: 読んでいる hooks・utils が他の lib や外からも使われる → 独立した小さな lib にする(`isClient`・`frameDims` の形で、この手順を先にその lib に当てる)。この lib だけが使う → lib の中へ移す。移したら呼び手を新しい場所へ直し、古いファイルは消す(`git mv`)
   - 確かめ: `git grep -n "@/hooks/<x>" -- src scripts` が 0
3. **自分を相対で読む**: lib の中で自分を `@/lib/<name>` で読む import を相対パスに直す(宣言の後は lint `lib-self-relative` が止める)
   - 確かめ: `git grep -nE "@/lib/<name>(/|['\"])" -- src/lib/<name>` が 0(区切りを付ける: `@/lib/request` だけだと `@/lib/requestMemo` にも当たる)
4. **package.json を置く**: `exports` は今のパスを写さず機能で整理し、外と fork が読む名前は全部入口に残す(消すのは破壊的変更 = notice を伴う別の変更)。入口の名前は `.`(client でも server でも読める物。入口に `"use client"` を書かない)・`./server`(DB・管理 SDK・秘密・node の API)・`./client`(import しただけでブラウザの SDK を引く物)・`./node`(Next の外のプログラム = scripts・eslint-rules・servers が読む物。React と Next を引かない)・`./points`(型だけの入口: lib が持ち主の点の約束の型だけ。差す側の項目はここだけを型として読む、D33)の 5 つだけ。`libs` = 直接読む lib、`peers` = 棚、`sideEffects` は書かない(手順 8)。形と問題の名前: [libPackage/README.md](./libPackage/README.md)・API「lib の package.json(宣言の形)」
   - 自分の節の lib(fork の自前の lib も)は `pnpm check lib-package -- declare <name>` が package.json と手順 5 の tsconfig.json の初めの形を推して書ける(既定 dry-run、決めきれない所を一覧に出す。祖先の lib は拒む。形: [scripts/structure/lib-package/README.md](../../scripts/structure/lib-package/README.md)「declare」)
   - 確かめ: `git grep -n '"\./' -- src/lib/<name>/package.json`(exports の鍵が上の 5 つだけ・値が lib の中の実ファイル)
   - 形の問題は `pnpm check lib-package` が守る(/sluice の検査が回す。tsconfig.json が無い問題は手順 5 で直す)。入口の名前の外の鍵は `entryName`、`.` の先頭の `"use client"` は `entryUseClient`、`./node` から React・Next を辿れば `nodeEntryReact`(道を出す)で落ちる
   - package.json を置いた時から lint `entry/only-entries` がその lib に効き、外から中のファイルを読む import が error になる(手順 7 で直すまで `pnpm lint` は落ちる)
5. **tsconfig.json を置く**: 無い間は `pnpm check lib-package` が置く中身を丸ごと出すので(作業の材料として出させる。通ったかは出荷の /sluice で読む)、それをそのまま `src/lib/<name>/tsconfig.json` に書く(依存の依存も閉包として入る。JS(`.mjs` / `.js`)のファイルを持つ lib は allowJs・allowImportingTsExtensions・checkJs と JS の include も入り、JS も型検査する。型の誤りは JSDoc で直す)。形: [scripts/structure/lib-package/README.md](../../scripts/structure/lib-package/README.md)
   - JS(`.mjs` / `.js`)の lib は、出荷の型検査の前に暗黙の any へ型を書く: `pnpm check lib-package -- jsdoc --lib <name>`(既定 dry-run、`--apply` で書く。`any` / `never[]` と出た所は本当の型に直す)。tsconfig は緩めない
   - 確かめ: `git diff -- src/lib/<name>/tsconfig.json`(paths = package.json の libs・peers の閉包と、設定を持つ lib の `@lib-config/<name>`・`@lib-config/<name>.ui` だけ)
   - その lib の単体の型検査は `pnpm check lib-package` が守る(/sluice の検査が回す)
6. **設定**(fork が変える値を持つ lib だけ): `config.ts` に既定(lib の設定の型で注釈)・`defineConfig`・入口から出す `XxxOverride` の型・`compose(上書き)` の結果を置き、上書きは `@lib-config/<name>` だけで読む(描画専用の `config.ui.ts` は `@lib-config/<name>.ui`)
   - 上流の空の上書き `src/config/lib/<name>.config.ts`(描画専用は `<name>.ui.config.ts`)を置く。lib が自前の合成(`defineXxxConfig` など)を持っていたら `defineConfig` に置き換えて消す
   - 上書きの値が効くテストを足す(toast の `config.test.ts` の形: 設定を受けて作る関数に `compose({...})` を渡す)。形: Extension「設定の届け方」・[defineConfig/README.md](./defineConfig/README.md)
   - 確かめ: `git grep -n "@lib-config/" -- src/lib/<name>`(自分の `<name>` / `<name>.ui` だけ)・`git ls-files "src/config/lib/<name>.*"`(持ち主の config ごとに上書きが 1 つ)
7. **呼び手を入口へ**: 外から lib の中のファイルを読む import(`@/lib/<name>/<中のファイル>`)を入口に直す(書き換えの codemod: `pnpm check lib-package -- codemod`、既定 dry-run。`-- codemod --help`)
   - 確かめ: `git grep -n "@/lib/<name>/" -- src scripts` が 0(入口のファイル名まで書く JS の入口 `@/lib/<name>/index.mjs` などは除く)
8. **sideEffects**: 既定は書かない。読み込んだだけで動く物(store を作る・登録を呼ぶ・CSS を読む)がある lib に `false` を置くと検査が止める。書くのは読み込み量を測って増えた所だけ
9. **moved: の行を書く**: 消えた・動いた古い指定子ごとに `moved: <古い指定子> -> <新しい入口>` を、コミットの本文と、依頼で行ったならその RESOLUTION の notes: に書く(fork への notice の材料)。名前を消した・変えたときはその名前と代わりも書く
    - 下書き: `pnpm check lib-package -- moved --base <閉じる前の rev>`(notice に貼れる moved: と imports: の塊)
    - 例: `moved: @/hooks/useIsClient -> @/lib/isClient` | `moved: @/lib/toast/useToast -> @/lib/toast` | `moved: TOAST_DEFAULT_DURATION(@/lib/toast/constants) -> src/config/lib/toast.config.ts の duration`

落とし穴:

- テストの中から子の `node --test` を起こすときは環境変数 `NODE_TEST_CONTEXT` を外す(外さないと子が黙ってテストを飛ばし exit 0 になる)
- 読み込み時に zustand の store を作る lib(toast)に `sideEffects: false` を置かない
- 型のテスト(`*.types.test.ts`)の注釈の文に `@ts-expect-error` の字を書かない(注釈も印として読まれ、使われない印で tsc が落ちる)
- 依存を足すと tsconfig.json の閉包も変わる。`pnpm check lib-package` が足す / 消す行を名指しするのでそれに合わせる
- 設定の値の検査(schema)に zod を使うと、その lib を読む画面の client の読み込み量が増えうる。型で足りるなら付けない

## API

### lib の package.json(宣言の形)

lib は `src/lib/<name>/package.json` で「外から読める入口」と「自分が読む物」を宣言する。読み手は 1 つ [`libPackage/`](./libPackage/README.md)(lint・単体用 tsconfig の検査・閉じたかの検査が同じものを読む)。

```json
{
  "exports": { ".": "./index.ts", "./server": "./server.ts" },
  "libs": ["cn"],
  "peers": ["components"],
  "sideEffects": false
}
```

- `exports`(必須): 入口の一覧。**鍵 = 入口の名前** `.`・`./server`・`./client`・`./node`・`./points` の 5 つだけ(意味は Usage 手順 4。ほかの名前は `pnpm check lib-package` が形の問題 `entryName` で止める。上流の lib にも fork の自前の lib にも効く)。**鍵 = 実パス**(`"."` = `./index.<ext>`、`"./x"` = `./x.<ext>` か `./x/index.<ext>`)。値は lib の中の実在するファイル 1 つ。パターン `./*`・条件分け(`import` / `default` など)・配列は使わない
- `libs`: この lib が読む他の lib の名前(`src/lib/<name>`)。読むのはその lib の入口だけ
- `peers`: 共有の同一性が要る棚(今は `components` = `src/components` だけ)
- `sideEffects`: 書かないのが既定。測って要る所だけ `false` か副作用のあるファイルの一覧(副作用を持つ lib に `false` を置くと `pnpm check lib-package` が止める)
- `name`・`dependencies` など他のキーは書かない(lib は `@/lib/<name>` で読む。`dependencies` は npm の更新の道具が本物の依存と読み違える)
- 上書き(設定)は指定子 `@lib-config/<自分>`(描画専用は `@lib-config/<自分>.ui`)だけで読む

lint(`eslint-rules/import-boundaries.mjs`、全 Tier error):

- `entry/only-entries`: 外から宣言済みの lib を読む import は exports の入口に当たること(`@/lib` の別名・相対・`"src/…"` を実パスに解いて照合。値も型も、scripts・テスト・.notices・eslint 設定からも)。宣言済みの lib の中からは `libs` の lib の入口・`peers` の棚・`@lib-config/<自分>`(と `<自分>.ui`)と外部パッケージだけを読む(features・app・hooks・utils・`@/config` は読まない)
  - 見ない物: 生成された一覧(`…/extensions/<file>`)の読み | 生成の印のあるファイル(`src/wiring/*.ts` などの結び目)から lib の項目 `src/lib/<lib>/plugs/**` への読み(項目は exports に出さない。plugs の外は入口だけ)
- `lib-self-relative`: 宣言済みの lib の中では自分を `@/lib/<自分>` で読まず相対パスで読む

lint は **package.json を持つ lib にだけ**効く。宣言の無い lib(package.json の無い `src/lib/<name>`)は `pnpm check lib-package` が不備 `undeclared` で落とす(上流にも fork の自前の lib にも)。本当に要る例外は理由つきの `eslint-disable`。

宣言の無い lib を閉じるときは Usage「lib を閉じる手順」に従う。

## Extension

### 設定の届け方

lib の設定(fork が値を変える物)は、lib の外の 1 ファイルの上書きで受ける。

- lib は上書きを指定子 `@lib-config/<自分>` だけで読む(描画専用の `config.ui.ts` を持つ lib はその上書き `src/config/lib/<自分>.ui.config.ts` を `@lib-config/<自分>.ui` で。lint `entry/only-entries` が他の書き方・他の lib の上書きを止める)。tsconfig.json の `"@lib-config/*": ["./src/config/lib/*.config.ts"]` の 1 行(上流が出荷、fork は編集しない)が `src/config/lib/<名前>.config.ts` へ向ける。候補は 1 つ
- 上書きのファイルが無いと tsc・tsx・テストが解決の失敗で止まる(黙って既定にならない)。上流は設定を持つ lib ごとに空の上書きを置く
- 上書きのファイルの形: lib の入口から型だけを読み、値はリテラルで書く(読んでよいのは `process.env`・`@/business`・段階の判定 `@/lib/appEnv` の引数なしの呼び出し(`isProduction()` など)・持ち主が config.ts の `overrideImports` で宣言した指定子だけ)。lint `config-overrides/literal-only` が止める(形の全部: [src/config/README.md](../config/README.md))

```ts
// src/config/lib/toast.config.ts
import type { ToastOverride } from "@/lib/toast";

export default { duration: 5000 } satisfies ToastOverride;
// 上流の空の上書き: export default {} satisfies ToastOverride;
// fork 独自のキー: export default { myKey: 1 } satisfies ToastOverride<{ myKey: number }>;
```

- lib の中の合成は共通の [`defineConfig`](./defineConfig/README.md)(既定 + 規則 → `compose(上書き)`)。lib は `defaults`・規則・`XxxOverride` の型・`compose` の結果を自分の config.ts に持つ
- lib ごとの合成(`defineXxxConfig` など)は、その lib を閉じる段で `defineConfig` に置き換える

## Verification

### 目録の検査（`pnpm test src/lib/folderCatalog/catalog.test.mjs`）

- `src/lib` 直下のディレクトリがすべて目録に載っている（載せ忘れ）
- 目録のパスがすべて実在する（上流のライブラリを消していないことの保証も兼ねる）
- 同じパスが 2 回載っていない（上流が後から同じ名前を足した = 名前の衝突、または昇格後の行の消し忘れ）
- 説明が空でない・節の見出しが所有者 ID の形式

検査と所有判定の実装は [`folderCatalog/`](./folderCatalog/README.md)。

### 読み込みの輪

静的な値の import で閉じる輪は全部禁止(`pnpm test scripts/structure/cycles/cycles.test.mjs`、build の冒頭でも走る。src 全体・全 Tier、例外の一覧は作らない)。型だけの輪と `import()` で閉じる輪は対象外。

輪を消すために `import type` や `import()` へ書き換えたら、**コミットに理由を書く**(実体の依存が残っていないか読み手が確かめるため)。普通は共通の部分を別のファイルへ切り出すか、入口でなく実ファイルを読む。

### lint の扱い

所有で厳しさが変わる規則（style-tokens の `no-raw-palette` / `no-bare-semantic-text` / `span-in-heading`）は、目録で判定する。

- 上流のライブラリ: error
- 自分のライブラリ: warn（自分が先頭の節 = Tier1 のときは error。upstream として自分のライブラリも契約どおりに保つ）
- 自分の名前(repo.json の repo_id)が読めない・目録が読めない: すべて error（安全側）
