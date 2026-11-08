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
