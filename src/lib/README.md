# src/lib — ライブラリ

ドメインに属さない、汎用で単体で完結した部品の置き場。どのプロジェクトに持っていっても使えるものを置く（エンティティが要るならドメイン = `src/features/`）。

**何があるか・誰が作ったかは [CATALOG.md](./CATALOG.md)（目録）を見る。** 新しいユーティリティや基盤を作る前に、目録で同等品が無いか確認する（重複実装の防止）。各ライブラリの詳しい仕様は、そのディレクトリの `README.md`。

lib の 1 つ 1 つは地区(district)の 1 種(ほかはドメイン・枠・proxies。定義と一覧: [districtMap/README.md](./districtMap/README.md)・`src/registry/district-map.jsonl`)。地区は何があり何を持つかの単位で、誰の物か(所有)は下の目録の側。

## ライブラリは「パッケージのような単位」

所有はフォルダ（`src/lib`）ではなく、**ライブラリ 1 つずつ**に付く。持ち主 = そのライブラリを作ったリポジトリ（Tier1 の upstream か、fork か）。目録の節がそれを表す。

- **上流のライブラリ**（自分以外の節にあるもの）
  - 公開している入口（`index.ts` などの export）を通して使う。**中身は編集しない・ディレクトリを削除しない**（使わないなら置いたまま。import されなければバンドルに入らない）
  - 挙動を変えたいときは、オプション・設定で変えられるよう上流に依頼する（`/order <上流リポ>`）。急ぎで手を入れたら、互換を保ったうえで修正を上流に返す（CLAUDE.md CORE_FILES `fork_core_edit_compat`）
- **自分のライブラリ**（自分の節にあるもの）: 完全に自分のもの。上流は触らない
- **入口は契約**: 上流は公開 API を改名するとき古い名前を残し、`.notices` で予告してから消す
- **昇格**: fork のライブラリが汎用的だと分かったら上流へ引き上げる（`/order <上流リポ>`）。上流の節に行が入ってきたら、fork は自分の複製と自分の節の行を消す（残っているとテストが「重複」で知らせる）

## ライブラリを足すとき

1. `src/lib/<name>/` を作る（名前は camelCase。入口は `index.ts` を推奨）
2. [CATALOG.md](./CATALOG.md) の**自分の節**に `- src/lib/<name> — <一行説明>` を足す。自分の節が無ければ末尾に `## <自分の所有者 ID>` を作る。他の節は編集しない
3. `pnpm test src/lib/folderCatalog/catalog.test.mjs` を通す

所有者 ID = 各リポの fork の名前（`.claude/rules/project.md` の `fork_id:`、読み手は `src/lib/forkOwnership/forkIds.mjs`）。origin の URL からは導かない。`.notices/applied/<fork_id>.md` の名前と同じ。

## lib の package.json(宣言の形)

lib は `src/lib/<name>/package.json` で「外から読める入口」と「自分が読む物」を宣言する。読み手は 1 つ [`libPackage/`](./libPackage/README.md)(lint・単体用 tsconfig の検査・閉じたかの検査が同じものを読む)。

```json
{
  "exports": { ".": "./index.ts", "./server": "./server.ts" },
  "libs": ["cn"],
  "peers": ["components"],
  "sideEffects": false
}
```

- `exports`(必須): 入口の一覧。**鍵 = 実パス**(`"."` = `./index.<ext>`、`"./x"` = `./x.<ext>` か `./x/index.<ext>`)。値は lib の中の実在するファイル 1 つ。パターン `./*`・条件分け(`import` / `default` など)・配列は使わない
- `libs`: この lib が読む他の lib の名前(`src/lib/<name>`)。読むのはその lib の入口だけ
- `peers`: 共有の同一性が要る棚(今は `components` = `src/components` だけ)
- `sideEffects`: 書かないのが既定。測って要る所だけ `false` か副作用のあるファイルの一覧(副作用を持つ lib に `false` を置くのはテストで止める)
- `name`・`dependencies` など他のキーは書かない(lib は `@/lib/<name>` で読む。`dependencies` は npm の更新の道具が本物の依存と読み違える)
- 上書き(設定)は指定子 `@lib-config/<自分>` だけで読む

lint(`eslint-rules/import-boundaries.mjs`、全 Tier error):

- `lib-entry`: 外から宣言済みの lib を読む import は exports の入口に当たること(`@/lib` の別名・相対・`"src/…"` を実パスに解いて照合。値も型も、scripts・テスト・.notices・eslint 設定からも)。宣言済みの lib の中からは `libs` の lib の入口・`peers` の棚・`@lib-config/<自分>` と外部パッケージだけを読む(features・app・hooks・utils・`@/config` は読まない)
- `lib-self-relative`: 宣言済みの lib の中では自分を `@/lib/<自分>` で読まず相対パスで読む

今は **package.json を持つ lib にだけ**効く。宣言の無い lib は error にせず、閉じたかの検査が数えて出す(全部閉じた段で error)。本当に要る例外は理由つきの `eslint-disable`。

宣言の無い lib を閉じるときは下の「lib を閉じる手順」に従う。

## 設定の届け方

lib の設定(fork が値を変える物)は、lib の外の 1 ファイルの上書きで受ける。

- lib は上書きを指定子 `@lib-config/<自分>` だけで読む(lint `lib-entry` が他の書き方・他の lib の上書きを止める)。tsconfig.json の `"@lib-config/*": ["./src/config/lib/*.config.ts"]` の 1 行(上流が出荷、fork は編集しない)が `src/config/lib/<名前>.config.ts` へ向ける。候補は 1 つ
- 上書きのファイルが無いと tsc・tsx・テストが解決の失敗で止まる(黙って既定にならない)。上流は設定を持つ lib ごとに空の上書きを置く
- 上書きのファイルの形: lib の入口から型だけを読み、値はリテラルで書く(読んでよいのは `process.env`・`@/business` と、段階の判定 `@/lib/appEnv` の `isProduction()` など引数なしの呼び出しだけ。D34・D87)。lint `config-overrides/literal-only` が止める(形の全部: [src/config/README.md](../config/README.md))

```ts
// src/config/lib/toast.config.ts
import type { ToastOverride } from "@/lib/toast";

export default { duration: 5000 } satisfies ToastOverride;
// 上流の空の上書き: export default {} satisfies ToastOverride;
// fork 独自のキー: export default { myKey: 1 } satisfies ToastOverride<{ myKey: number }>;
```

- lib の中の合成は共通の [`defineConfig`](./defineConfig/README.md)(既定 + 規則 → `compose(上書き)`)。lib は `defaults`・規則・`XxxOverride` の型・`compose` の結果を自分の config.ts に持つ
- lib ごとの合成(`defineFontsConfig` など)は、その lib を閉じる段で `defineConfig` に置き換える

## lib を閉じる手順

lib 1 本を「閉じた lib」(package.json の入口だけを外から読み、宣言した物だけを読む)にする手順。1 クエスト = 1 lib。見本 = `toast`・`isClient`・`frameDims`・`defineConfig`(`git log -- src/lib/toast` で実際の差分を見られる)。各段の右の確かめが通ってから次へ進む。

0. **始める前**: 同じ lib を他の作業(受信箱の指令・クエスト・ギルド)が触っていないか確かめる(受信箱 `~/.team/orders/<repo-id>/` の指令に lib の名前が出ないか・進行中の作業の範囲に lib のフォルダが入っていないか)。今の状態を見る: `pnpm check lib-package -- --list`(lib ごとに `closed` / `gaps` / `undeclared`。道具からは `-- --json`)
1. **依存を洗い出す**: lib の中から外を読む import を一覧にし、lib / 棚(`@/components`)/ hooks・utils / `@/config` / features・app に仕分ける。features・app・`@/config` は読めない(D83)→ 引数・注入で受けるか、値なら手順 6 の設定にする
   - 確かめ: `git grep -nE "from ['\"]@/" -- src/lib/<name>` と、相対で lib の外へ出る `git grep -n "from ['\"]\.\./\.\./" -- src/lib/<name>`
2. **hooks / utils**: 読んでいる hooks・utils が他の lib や外からも使われる → 独立した小さな lib にする(`isClient`・`frameDims` の形で、この手順を先にその lib に当てる)。この lib だけが使う → lib の中へ移す(D93)。移したら呼び手を新しい場所へ直し、古いファイルは消す(`git mv`)
   - 確かめ: `git grep -n "@/hooks/<x>" -- src scripts` が 0
3. **自分を相対で読む**: lib の中で自分を `@/lib/<name>` で読む import を相対パスに直す(D100。宣言の後は lint `lib-self-relative` が止める)
   - 確かめ: `git grep -nE "@/lib/<name>(/|['\"])" -- src/lib/<name>` が 0(区切りを付ける: `@/lib/request` だけだと `@/lib/requestMemo` にも当たる)
4. **package.json を置く**: `exports` は今のパスを写さず機能で整理し、外と fork が読む名前は全部入口に残す(消すのは破壊的変更 = 別の指令)。`libs` = 直接読む lib、`peers` = 棚、`sideEffects` は書かない(手順 8)。形と問題の名前: [libPackage/README.md](./libPackage/README.md)・上の「lib の package.json(宣言の形)」
   - 確かめ: `pnpm check lib-package`(形の問題が 0。tsconfig.json が無い問題は残るので手順 5 で直す)
   - package.json を置いた時から lint `lib-entry` がその lib に効き、外から中のファイルを読む import が error になる(手順 7 で直すまで `pnpm lint` は落ちる)
5. **tsconfig.json を置く**: 無い間は `pnpm check lib-package` が置く中身を丸ごと出すので、それをそのまま `src/lib/<name>/tsconfig.json` に書く(依存の依存も閉包として入る。JS(`.mjs` / `.js`)のファイルを持つ lib は allowJs・allowImportingTsExtensions・checkJs と JS の include も入り、JS も型検査する。型の誤りは JSDoc で直す)。形: [scripts/structure/lib-package/README.md](../../scripts/structure/lib-package/README.md)
   - 確かめ: `pnpm check lib-package`(その lib の単体の型検査が通る)
6. **設定**(fork が変える値を持つ lib だけ): `config.ts` に既定(lib の設定の型で注釈)・`defineConfig`・入口から出す `XxxOverride` の型・`compose(上書き)` の結果を置き、上書きは `@lib-config/<name>` だけで読む。上流の空の上書き `src/config/lib/<name>.config.ts` を置く。lib が自前の合成(`defineXxxConfig` など)を持っていたら `defineConfig` に置き換えて消す(L1.23)。上書きの値が効くテストを足す(toast の `config.test.ts` の形: 設定を受けて作る関数に `compose({...})` を渡す)。形: 上の「設定の届け方」・[defineConfig/README.md](./defineConfig/README.md)
   - 確かめ: `pnpm test src/lib/<name>`。上書きのファイルを一時的に外すと `pnpm check lib-package` が TS2307 で止まる
7. **呼び手を入口へ**: 外から lib の中のファイルを読む import(`@/lib/<name>/<中のファイル>`)を入口に直す(今は手で。書き換えの codemod は指令 27 で入る予定)
   - 確かめ: `pnpm lint`(lib-entry の innerImport が 0)・`git grep -n "@/lib/<name>/" -- src scripts` が 0
8. **sideEffects**(D86): 既定は書かない。読み込んだだけで動く物(store を作る・登録を呼ぶ・CSS を読む)がある lib に `false` を置くと検査が止める。書くのは読み込み量を測って増えた所だけ
9. **検査を回す**: `pnpm check lib-package -- --list`(その lib が `closed`)・`pnpm lint`・`pnpm typecheck`・`pnpm test src/lib/<name>`・`pnpm check --gate=ship`。client で読む lib・設定を持つ lib は `pnpm build` も
   - テストの無い lib は `pnpm test src/lib/<name>` が「選んだテストは 0 本」で通る(exit 0)。閉じる作業でテストを足す決まりは無い(手順 6 の上書きのテストは別)
10. **moved: の行を書く**: 消えた・動いた古い指定子ごとに `moved: <古い指定子> -> <新しい入口>` を、コミットの本文とクエストの RESOLUTION の notes: に書く(fork への notice の材料)。ギルドなら竣工報告の notes: に書く。名前を消した・変えたときはその名前と代わりも書く
    - 例: `moved: @/hooks/useIsClient -> @/lib/isClient` | `moved: @/lib/toast/useToast -> @/lib/toast` | `moved: TOAST_DEFAULT_DURATION(@/lib/toast/constants) -> src/config/lib/toast.config.ts の duration`

落とし穴:

- テストの中から子の `node --test` を起こすときは環境変数 `NODE_TEST_CONTEXT` を外す(外さないと子が黙ってテストを飛ばし exit 0 になる)
- 読み込み時に zustand の store を作る lib(toast)に `sideEffects: false` を置かない
- 型のテスト(`*.types.test.ts`)の注釈の文に `@ts-expect-error` の字を書かない(注釈も印として読まれ、使われない印で tsc が落ちる)
- 依存を足すと tsconfig.json の閉包も変わる。`pnpm check lib-package` が足す / 消す行を名指しするのでそれに合わせる
- 設定の値の検査(schema)に zod を使うと、その lib を読む画面の client の読み込み量が増えうる。型で足りるなら付けない

## 目録の検査（`pnpm test src/lib/folderCatalog/catalog.test.mjs`）

- `src/lib` 直下のディレクトリがすべて目録に載っている（載せ忘れ）
- 目録のパスがすべて実在する（上流のライブラリを消していないことの保証も兼ねる）
- 同じパスが 2 回載っていない（上流が後から同じ名前を足した = 名前の衝突、または昇格後の行の消し忘れ）
- 説明が空でない・節の見出しが所有者 ID の形式

検査と所有判定の実装は [`folderCatalog/`](./folderCatalog/README.md)。

## 読み込みの輪

静的な値の import で閉じる輪は全部禁止(`pnpm test scripts/structure/cycles/cycles.test.mjs`、build の冒頭でも走る。src 全体・全 Tier、例外の一覧は作らない)。型だけの輪と `import()` で閉じる輪は対象外。

輪を消すために `import type` や `import()` へ書き換えたら、**コミットに理由を書く**(実体の依存が残っていないか読み手が確かめるため)。普通は共通の部分を別のファイルへ切り出すか、入口でなく実ファイルを読む。

## lint の扱い

所有で厳しさが変わる規則（style-tokens の `no-raw-palette` / `span-in-heading`）は、目録で判定する。

- 上流のライブラリ: error
- 自分のライブラリ: warn（自分が先頭の節 = Tier1 のときは error。upstream として自分のライブラリも契約どおりに保つ）
- origin が無い・目録が読めない: すべて error（安全側）
