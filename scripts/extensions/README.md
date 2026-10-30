# 拡張点の生成器(extensions:generate / extensions:check)

機能ごとの「差し込み口(拡張点)」を持ち主が宣言し、そこへ置かれた項目の一覧を生成する仕組み。上流の既定の項目も fork の項目も同じ受け口に置き、同じ一覧に並ぶ。

| コマンド | すること |
|---|---|
| `pnpm extensions:generate` | 全宣言を読み、全一覧を丸ごと書く(問題があれば書かずに止まる)。宣言の消えた古い一覧(目印のヘッダ付き)は消す |
| `pnpm extensions:check` | 一覧が宣言・項目と一致するか、1 行スイッチの形、上流が override を持たないかを見る(build の冒頭で走る)。書かない |
| `pnpm test:extensions` | 生成器の回帰テスト(fixture)と実リポの一致 |

src/registry の α(serviceRegistry など)は `registry:generate` / `registry:check` の側で、ここでは扱わない。

## 宣言(extensionPoints.ts)

持ち主のフォルダの直下に手書きで 1 つ置く(そのフォルダの全拡張点の目次)。持ち主 = ドメイン(`src/features/**/<domain>/`)、画面側の点は持ち主の route の `_layout/` `_screen/`、proxy は `src/proxies/`、lib が持ち主の点は `src/lib/<lib>/`。宣言は src の下のどこに置いても読まれる(node_modules・`extensions/` の中は見ない)。

```ts
export const extensionPoints = {
  definitions: {
    dir: "milestones",                                              // 受け口(持ち主のフォルダからの相対、"." = 直下)
    export: "milestone",                                            // 項目が export する名前(印)
    type: { from: "@/features/milestone/types", name: "MilestoneDefinition" }, // 一覧の要素の型
    side: "server",                                                 // server | client | shared(読み手の側。今は記録だけ)
  },
};
```

- **リテラルだけ**で書く: 文字列・真偽・数・配列・object。変数・式・関数呼び出し・テンプレート・spread は失敗(生成器は TypeScript の構文木で字面を読み、実行しない)
- 点の名前 = 一覧のファイル名 = export する一覧の名前。項目の種類の複数形 camelCase(ドメイン名・Registry を付けない)
- 省略できるキー:
  - `key: "<プロパティ>"` … 一覧を `Record<string, T>` にする(各項目の値のそのプロパティが鍵。重複は読み込み時に例外)
  - `load: "lazy"` … 項目を import せず `{ name, load: () => import(…) }` の配列にする(必要なときだけ読む。key・derive とは併用不可)
  - `target: "wiring"` … 一覧を `src/wiring/<持ち主のフォルダ名>.ts` に出す(lib が持ち主の点。同じ lib の点は 1 本にまとめる)
  - `ignore: ["<ファイル名>", …]` … 受け口の直下にある、項目でないファイル(proxy の骨組みなど)
  - `alwaysOn: true` … 常に読まれる処理(cron・退会など)から走る点の印。項目が機能を閉じる規則のフォルダを import するなら項目に `enabled` が要る(`FEATURE_GATE_CHECK=all pnpm test:feature-gate`)
  - `derive: "featureTables"` … 組み込みの変換。機能を閉じる規則の `features` のフォルダから `tables` を導いて項目に付ける(`derive/featureTables.mjs`)。fork が変換を足す口は無い
- fork が上流の持ち主のフォルダに自分の点を足すときは、隣に `extensionPoints.<fork の名前>.ts`(同じ書式)。上流の点と同じ名前は失敗(上流が後から同じ名前を足したら fork の点を改名する)。fork 自身のドメインは普通の `extensionPoints.ts`

## 項目

受け口(`dir`)の直下に、次の 2 形のどちらかで置く。並び = ファイル名の順(Tier の順は使わない)。

- ファイル: `<名前>.ts(x)`(上流)/ `<名前>.<fork の名前>.ts(x)`(fork)
- フォルダ: `<名前>[.<fork の名前>]/index.ts(x)`(中の index が項目、ほかのファイルは部品)

受け口のフォルダが無い点は項目 0(一覧は空)。上流の項目が 0 の受け口は、intake の行が実在を見るので置き方を書いた README.md を置く(`.ts(x)` でないファイルは項目に数えない)。印 = `export const <export>` の形(字面で見る。`export { x as <export> }` は拾わない)。項目のファイルは生成器から import しない。fork の名前は宣言済みのもの(`.claude/rules/project.md` の `fork_id:` と祖先の台帳名、`src/lib/forkOwnership/forkIds.mjs`)。

失敗(書き出さない): 宣言に無い fork の名前 / 印が無い(受け口に置くのは項目だけ。部品は責務のドメインへ)/ 同じ受け口の 2 つの点の印を両方持つ / index の無いフォルダ / 同じ名前のファイルとフォルダ / 名前の形。テスト(`*.test.*`)・`.d.ts`・`.ts(x)` 以外・`extensions/`・ほかの点の受け口のフォルダは見ない。

## 一覧(生成物)

- 置き場: `<持ち主>/extensions/<点>.ts`(`target: "wiring"` は `src/wiring/<lib>.ts`)。中身は全部生成物で、1 行目は共通の目印「`// 生成物・編集不可: pnpm extensions:generate が <宣言のファイル> から生成する`」
- 項目の import は `@/…` の形(拡張子・フォルダの index を除く)
- `extensions/` の下に宣言に無いファイルがあれば `extensions:check` が失敗する: 目印の無いもの = 手で置いたファイル(「受け口は <dir>」と示す)、目印のあるもの = 宣言の消えた古い一覧(`extensions:generate` が消す)
- 生成物はコミットする。/flux で上流を取り込んだら作り直してコミットし、衝突はどちらかを採って作り直す
- 所有: `src/**/extensions/**` は intake の generated 行、`src/**/extensionPoints.*.ts` は fork の受け口(`src/lib/forkOwnership/intake.txt`)

## 1 行スイッチ(画面以外の、1 つだけの実装を差し替える口)

一覧に並べるのでなく「どれか 1 つ」を使う実装(決済の enricher など)は、既定の隣に 1 行のスイッチを置く。

| ファイル | 中身 | 持ち主 |
|---|---|---|
| `<名前>.ts(x)` | 呼び手が import する素の名前。`export … from "./<名前>.default";` の re-export 1 文だけ | 採用者(fork が `./<名前>.<fork の名前>` に書き換える) |
| `<名前>.default.ts(x)` | 上流の既定の実装 | 上流 |
| `<名前>.<fork の名前>.ts(x)` | fork の実装(既定と同じ export の形) | fork |

- 検査(`extensions:check`、`switches.mjs`): `<名前>.default.ts(x)` があれば隣にスイッチが要る / スイッチはコメントを除いて re-export 1 文だけ / 指す先は `<名前>.default` か宣言済みの `<名前>.<fork の名前>` で実在する / 上流(Tier1)のスイッチは `.default` を指す
- 多段: 下の Tier は同じスイッチを書き換える(親の実装を使い続けるなら触らない)
- page.tsx・枠の layout.tsx の 1 行スイッチ(`_screen` / `_components` を指す)は別の仕組み(`src/lib/screens/README.md`、`test:screens`)

## override(既定を変える隣のファイル)

- 対象ごとに 1 本: `<対象>.override.ts(x)`(例 `domainEntry.override.ts`)、cron は `src/app/api/cron/<name>/override.ts`。Tier 別・fork の名前付きのファイルは作らない
- 足した Tier の物。下の Tier は同じファイルを書き換える: 受け継ぐ = 触らない / 既定へ戻す = キーを消すかファイルを消す / 全部を戻す = 空(空白とコメントだけ = 不在と同じ)。合成は git の merge だけ
- **上流(Tier1)は override を出荷しない**(空のものも)。既定は既定の場所に書く。検査: `extensions:check`(`overrides.mjs`)
- 生成器・検査は空のファイルと不在を同じに扱う(cron の `scripts/cron/discover.ts`・`scripts/registry/serviceRegistry/discover.mjs`)

## ファイル

| ファイル | 中身 |
|---|---|
| `declarations.mjs` | 宣言の探索とリテラルの読み取り、fork の点の重なりの検査 |
| `extensions.mjs` | 項目の走査・一覧の組み立て・ずれと手で置いたファイルの検出 |
| `derive/featureTables.mjs` | 組み込みの変換(規則の features → tables) |
| `switches.mjs` / `overrides.mjs` | 1 行スイッチの形と、上流の override の検査 |
| `generate.mjs` / `check.mjs` | コマンドの入口 |
