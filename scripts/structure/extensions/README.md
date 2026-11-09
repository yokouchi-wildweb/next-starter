# 拡張点の生成器(pnpm generate extensions / pnpm check extensions)

機能ごとの「差し込み口(拡張点)」を持ち主が宣言し、そこへ置かれた項目の一覧を生成する仕組み。上流の既定の項目も fork の項目も同じ受け口に置き、同じ一覧に並ぶ。ファイル名に fork の名前の印は付けない(D137)。fork の物か上流の物かは名前でなく git の分岐点(merge-base)で `pnpm workflow ownership check` が見る(`src/lib/forkOwnership/README.md`)。

| コマンド | すること |
|---|---|
| `pnpm generate extensions` | 全宣言を読み、全一覧と受け口の一覧(`intake.txt`)の生成区画を丸ごと書く(問題があれば書かずに止まる)。宣言の消えた古い一覧(目印のヘッダ付き)は消す |
| `pnpm check extensions` | 一覧と生成区画が宣言・項目と一致するか、1 行スイッチの形、孤立した `.replace` / `.override`(1 つの孤立の検査 `orphans.mjs`)・宣言に無い鍵(`overrideKeys.mjs`)、上流が override を持たないかを見る(build の冒頭で走る)。書かない |
| `pnpm test scripts/structure/extensions/` | 生成器の回帰テスト(fixture)と実リポの一致 |

src/registry の α(serviceRegistry など)は `pnpm generate registry` / `pnpm check registry` の側で、ここでは扱わない。

## 宣言(extensionPoints.ts)

持ち主のフォルダの直下に手書きで 1 つ置く(そのフォルダの全拡張点の目次。1 フォルダ 1 宣言)。読み手は `src/lib/districtMap/declarations.mjs` の 1 か所で、生成器・所有の検査の単位名・`src/wiring` の配線テスト・ロールの上書きが同じものを使う(D2)。持ち主 = ドメイン(`src/features/**/<domain>/`)、画面側の点は持ち主の route の `_layout/` `_screen/`、proxy は `src/proxies/`、lib が持ち主の点は `src/lib/<lib>/`。宣言は src の下のどこに置いても読まれる(node_modules・`extensions/` の中は見ない)。

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
  - `key: "<プロパティ>"` … 一覧を `Record<string, T>` にする(各項目の値のそのプロパティが鍵。重複は読み込み時に例外。null プロトタイプなので外から来た名前で引いても `constructor` などに当たらない)
  - `literalKeys: true` … `key` と一緒に使い、鍵の文字列を一覧の型に残す(項目の型が鍵を文字列リテラルで持つこと。登録済みの名前の union を型で導く点)
  - `load: "lazy"` … 項目を import せず `{ name, load: () => import(…) }` の配列にする(必要なときだけ読む。key・derive とは併用不可)
  - `target: "wiring"` … 一覧を `src/wiring/<持ち主のフォルダ名>.ts` に出す(lib が持ち主の点。同じ lib の点は 1 本にまとめる)
  - `ignore: ["<ファイル名・フォルダ名>", …]` … 受け口の直下にある、項目でないファイルとフォルダ(proxy の骨組み・proxies のテーマのフォルダなど)
  - `files: "*/<ファイル名>"` … 受け口の 1 段下の決まった名前のファイルが項目(デモの `*/_demo.ts`)。項目名 = フォルダ名で、一覧の各項目に `folder: "<フォルダ名>"` が付く(一覧の型は `folder` を持つ)。ファイルの無いフォルダは項目でない。フォルダの名前に fork の印は付けない
  - `shape: "object"` … 一覧を `{ <項目の名前>: 項目 }` の null プロトタイプの object で出す(キーを型に残す。`key`・`load`・`files` とは併用不可)。同じ名前は失敗
  - `pureImports: true` … 項目から値 import を推移的に辿り、`zod` と src の下の純関数・値以外(react・next・server-only・サービス・部品・DB の定義)へ届いたら失敗。型だけの import は辿らない(`pureImports.mjs`)
  - `requireText: "<字面>"` … 項目のファイルにその字面が無ければ失敗(setting の `.default(`)
  - `overrideOf: ["<属性>", …]` … 項目の隣の `<名前>.override.ts` の `export const override = { … }` を一覧に重ねる(一部の上書き)。書けるのは挙げた属性だけ。対象の項目が受け口に無ければ失敗(孤立)、`overrideOf` の無い点の受け口に置いた override も失敗。上の Tier の項目にだけ置ける(fork が自分で足した項目への override は `pnpm workflow ownership check` の override-own。fork の項目は直接書き換える)。上流は出さない(`overrides.mjs`)。空のファイルは不在と同じ
  - `alwaysOn: true` … 常に読まれる処理(cron・退会など)から走る点の印。項目が機能を閉じる規則のフォルダを import するなら項目に `enabled` が要る(`FEATURE_GATE_CHECK=all pnpm test src/featureGate scripts/structure/proxies`)
  - `derive: "settingSections"` … 組み込みの検査。項目の `section:` が同じ持ち主の点 `sections` の `key:` にあるかを見る。上書きが権限を広げないか(キー・セクションの `allowRoles` と `ui.section` を字面で読み、重ねる前と後の実効の権限を比べる)も見る(`derive/settingRoles.mjs`)
  - `derive: "featureTables"` … 組み込みの変換。機能を閉じる規則の `features` のフォルダ(ドメインの位置 `core/<名前>` か `<名前>`。無い・位置でない書き方は止める)から `tables`(表を持たないドメインは空)と汎用 API の住所 `domainApiPaths`(フォルダの `domainEntry.ts` のキー → `/api/<キー>`、項目の `pathPatterns` の後ろにも足す)と設定の節の住所 `settingPaths`(節の `feature` → `/admin/settings/<key>`、`derive/gateSettingPaths.mjs`)と cron の task の住所 `cronPaths`(`src/app/api/cron/<名>/task.ts`・`task.override.ts` の値の import が `features` のフォルダに当たる → `/api/cron/<名>`。規則に手書きした `/api/cron/` は止める)を導き、項目の名前(ファイル名)を `name` に付け、名前の union `export type FeatureName` も出す(`derive/featureTables.mjs`)。fork が変換を足す口は無い
- 受け口でない点(一覧はこの生成器が書かない。受け口のフォルダの行も無い。判定 `isListPoint`):
  - `writer: "role:generate"` + `side` … 一覧を別の生成器が書く点(ロール・プロフィール)
  - `placement: "<置き場の glob>"` + `kind: "edit" | "append"` … 置き場の点(型 4)。fork が書いてよい場所(リポジトリ直下から、`src/` 始まり)とその書き方。受け口の一覧の行になるだけ(項目も一覧も無い)
  - `overrides: "<対象のファイルの glob>"` + `export: "<上書きの export の名前>"` + `side` + `overrideOf: [...]`(+ `keyedBy: "<対象の export>"`)… 上書きの対象の点。glob はリポジトリ直下から(`src/` 始まり、`..` 無し)。対象(ロール・プロフィールの JSON・cron の `task.ts`・`domainEntry.ts`)の隣の `.override.ts` が書いてよい鍵を `overrideOf` で名乗る。`addable: true` = fork が同じ場所に対象を足してよい(ロール・プロフィールの JSON)。宣言は `as const` で書き、上書きの型(`RoleOverride` など)は `overrideOf` から引く(`(typeof extensionPoints.<点>.overrideOf)[number]`)。読み手(`scripts/structure/role/overrides.mjs`・`src/lib/cron/discover.ts`・`scripts/structure/registry/serviceRegistry`)は自前の鍵の一覧を持たず `overrideKeysOf`(`src/lib/districtMap/declarations.mjs`)で読み、値の検査だけを持つ。安全の制限(core ロールの `enabled`・プロフィールの `fields`)は「宣言に鍵が無い」で表す
- fork の拡張点は fork 自身のフォルダ(fork が足したドメイン・lib)の `extensionPoints.ts` に宣言する。上流の持ち主のフォルダには足さない(旧い `extensionPoints.<x>.ts` は生成が止まり、移し方 = 共有の棚の印の移行の notice を案内する)

## 項目

受け口(`dir`)の直下に、次の 2 形のどちらかで置く。名前は英字始まりの英数字で、上流の項目も fork の項目も印なし。並び = ファイル名の順(Tier の順は使わない)。

- ファイル: `<名前>.ts(x)`
- フォルダ: `<名前>/index.ts(x)`(中の index が項目、ほかのファイルは部品)

受け口のフォルダが無い点は項目 0(一覧は空)。印 = `export const <export>` の形(字面で見る。`export { x as <export> }` は拾わない)。項目のファイルは生成器から import しない。

点つきの名前の分類は `src/lib/districtMap/dottedNames.mjs` の 1 か所(`.default` / `.replace` / `.override` / `.client` / `.test` / それ以外 = 旧い fork の名前の印)。受け口で許すのは印なしの名前と、`overrideOf` の点の `<名前>.override.ts` だけ。`<名前>.replace` は 1 行スイッチの置き換えで、受け口の項目ではない(下の孤立の検査)。

失敗(書き出さない): 旧い fork の名前の印(`<名前>.<x>.ts`・`<名前>.<x>/`。印なしの名前への改名と移し方 = 共有の棚の印の移行の notice を案内する)/ 印(export)が無い(受け口に置くのは項目だけ。部品は責務のドメインへ)/ 同じ受け口の 2 つの点の印を両方持つ / index の無いフォルダ / 同じ名前のファイルとフォルダ / 名前の形。テスト(`*.test.*`)・`.d.ts`・`.ts(x)` 以外・`extensions/`・ほかの点の受け口のフォルダは見ない。

上流と同じ単位名(`x.ts` と `x.tsx`、ファイルとフォルダ)の fork の追加は、生成器ではなく `pnpm workflow ownership check` の unit-clash が止める(git の分岐点が要るため。build の生成器は git を使わない)。

鍵の重複: 項目の一意の名前(`key` の点のほか purchaseType・jobType・rewardKey・用途 ID など)が 2 つあれば読み手が例外を投げる。ファイル名の順で後が勝つ差し替えは無い。上流の組み込み項目を差し替えたい fork は、上流へ 1 行スイッチを依頼する(`/order`)。

## 一覧(生成物)

- 置き場: `<持ち主>/extensions/<点>.ts`(`target: "wiring"` は `src/wiring/<lib>.ts`)。中身は全部生成物で、1 行目は共通の目印「`// 生成物・編集不可: pnpm generate extensions が <宣言のファイル> から生成する`」
- 項目の import は `@/…` の形(拡張子・フォルダの index を除く)。import の別名は `<点の名前>_<項目の名前>`(1 本の wiring に別の点の同じ名前の項目が混ざっても、予約語の項目名でも衝突しない)
- `extensions/` の下に宣言に無いファイルがあれば `pnpm check extensions` が失敗する: 目印の無いもの = 手で置いたファイル(「受け口は <dir>」と示す)、目印のあるもの = 宣言の消えた古い一覧(`pnpm generate extensions` が消す)
- 生成物はコミットする。/flux で上流を取り込んだら作り直してコミットし、衝突はどちらかを採って作り直す
- 所有: `src/**/extensions/**` は intake の generated 行。受け口のフォルダへの fork の追加は intake の生成区画の add 行(下)

## 1 行スイッチ(画面以外の、1 つだけの実装を差し替える口)

一覧に並べるのでなく「どれか 1 つ」を使う実装(決済の enricher など)は、既定の隣に 1 行のスイッチを置く。

| ファイル | 中身 | 持ち主 |
|---|---|---|
| `<名前>.ts(x)` | 呼び手が import する素の名前。`export … from "./<名前>.default";` の re-export 1 文だけ | 採用者(fork が `./<名前>.replace` に書き換える) |
| `<名前>.default.ts(x)` | 上流の既定の実装 | 上流 |
| `<名前>.replace.ts(x)` | fork の丸ごと置き換え(既定と同じ export の形) | 足した Tier |

- 検査(`pnpm check extensions`、`switches.mjs`): `<名前>.default.ts(x)` があれば隣にスイッチが要る / スイッチはコメントを除いて re-export 1 文だけ / 指す先は `<名前>.default` か `<名前>.replace` で実在する(旧い fork の名前の印つきの先は止めて移し方を案内する)/ 上流(Tier1)のスイッチは `.default` を指す / 孤立した `<名前>.replace` は下の孤立の検査
- 多段: 下の Tier は同じスイッチを書き換える(親の実装を使い続けるなら触らない)
- `.default` は作ったリポが出す既定の共通の印(D171)で、1 行スイッチだけの物ではない。`.default` を使うほかの仕組みは自分のファイルの形を 1 か所で公開し(例 `frames.mjs` の `CLAIMED_DEFAULTS` = `src/app` の `frame.default.ts`。形 `{ by, under, name | pattern }`)、`switches.mjs` の `CLAIMERS` に足す。名乗った形はスイッチの既定として扱わない
- page.tsx・枠の layout.tsx の 1 行スイッチ(`_screen` / `_components` を指す)は別の仕組み(`src/lib/screens/README.md`、`pnpm test src/lib/screens/screens.test.mjs`)

## override(既定を変える隣のファイル)

- 一部の上書き(丸ごと置き換えは `.replace`、D136)。対象ごとに 1 本: `<対象>.override.ts(x)`(例 `domainEntry.override.ts`・`user.role.override.ts`・`user.profile.override.ts`)、cron は task.ts の隣の `src/app/api/cron/<name>/task.override.ts`(旧名の素の `override.ts` は `scripts/structure/cron/discover.ts` が改名を案内して止める)。Tier 別・fork の名前付きのファイルは作らない
- 孤立の検査は 1 つ(`orphans.mjs`、全 Tier、D165): src の下の `<対象>.override.ts(x)` と `<名前>.replace.ts(x)` を 1 回の走査で集めて照らす
  - `.override`: 受け口のフォルダ(`overrideOf` の点。項目と照らすのは `extensions.mjs`)か、上書きの対象の点(宣言の `overrides` の隣の glob)で隣に対象があること。どちらでもなければ「受ける点が無い」、対象が無ければ孤立。空は不在と同じで見ない
  - `.replace`: route の `_layout` / `_screen` の中は、そのルートの page.tsx / layout.tsx の 1 行スイッチの向け先か、隣に `<名前>.default` があること(`src/lib/screens` の `findRouteReplaceProblems`)。隣に印なしの部品があるだけの `.replace` は置き換えの口でない: fork の部品はルートの `_components/` に印なしの名前で置く。それ以外の場所は隣に `<名前>.default`。`_components/` の中は見ない
  - 宣言に無い鍵(`overrideKeys.mjs`): 上書きの対象の点の上書きの export(宣言の `export`)のキーは `overrideOf` の中だけ。`keyedBy` の点(domainEntry)はキーが隣の対象のその export のキーの中だけ、値は宣言の 1 つの属性。値の検査は各読み手(ロール・cron・tsc)
- 上の Tier の物にだけ置ける: fork が足した override の対象が基準に無ければ `pnpm workflow ownership check` の override-own
- 足した Tier の物。下の Tier は同じファイルを書き換える: 受け継ぐ = 触らない / 既定へ戻す = キーを消すかファイルを消す / 全部を戻す = 空(空白とコメントだけ = 不在と同じ)。合成は git の merge だけ
- **上流(Tier1)は override を出荷しない**(空のものも)。既定は既定の場所に書く。検査: `pnpm check extensions`(`overrides.mjs`)
- 生成器・検査は空のファイルと不在を同じに扱う(cron の `src/lib/cron/discover.ts`・`scripts/structure/registry/serviceRegistry/discover.mjs`)

## 枠の表(frame.default.ts / frame.ts の宣言から)

- `src/app` の `frame.default.ts`(ルートを作ったリポの既定、`frameDefault`)と `frame.ts`(その下のリポの宣言、`frame`。既定の上に重なる)を `frames.mjs` が字面で読み(`literalOf`)、親の鎖を解決した表を枠の根ごとに `<枠の根>/_layout/extensions/frameTable.ts` へ書く(`src/app/(user)`・`src/app/admin`。一覧の数に入る)。範囲はキー `layout` / `page` で名指す。宣言の書き方・重ねる順・表の形: `src/app/_layout/frame/README.md`
- 失敗: 枠の外・隣に layout / page が無い・`layout:` / `page:` の相手が無い・キーが無い・知らないキー・private / @slot / intercepting の下・形の違う値・宣言にない部位・ほかの名前(`frame.override.ts` など)・上流(Tier1)の `frame.ts`。全部の部位を隠す宣言は warn(止めない)
- 親の物の隣に `*.default.*` を足す・親の既定を書き換えるのは `pnpm workflow ownership check` の default-add / default-edit(git の分岐点が要るので生成器は見ない)。親のルートの隣に `frame.ts` を足すのは intake の `add` 行

## 受け口の一覧の生成区画(intake.txt)

`src/lib/forkOwnership/intake.txt` の `# === AUTO-GENERATED intake START ===` 〜 `END` の間は `pnpm generate extensions` が書き、ずれは `pnpm check extensions` が止める(`intake.mjs`、区画の差し替えは `src/lib/forkOwnership/intake.mjs`)。src の下の行は全部ここ。行の種類は手書きだったときと同じ(下の Tier の書き換えの判定が変わらない。`intakeFromDeclarations.test.mjs`)。並び(最後に当たった行が効く):

1. 置き場(placement の点): `<kind> <glob>`
2. 画面: ルートの `page.tsx`(`src/lib/screens/routeTree.mjs` の discoverRoutes = ルートの地図と同じ見つけ方を src/app から直に。`pnpm generate routes` を待たない)と枠の 1 行スイッチの `layout.tsx`(parseSwitchLayout)= `edit`。パスの `[slug]` などは `[[]`・`[]]` で包む(`literalGlob`、node:path の matchesGlob の字の組)
3. 宣言の受け口のフォルダ: `add <dir>/*.{ts,tsx}` とフォルダ形 `add <dir>/*/**`(files の点は `add <持ち主>/*/<ファイル名>`)
4. 1 行スイッチ: 素の名前 `edit <dir>/<名前>.ts(x)`(向け先を替える)と置き換え `add <dir>/<名前>.replace.{ts,tsx}`
5. 上書きの対象の点(`overrides`): 隣の上書き `edit <glob の最後の拡張子を .override.ts に>`(多段で下の Tier が親の上書きを書き換える)、`addable` の点は対象そのものも `add <glob>`
6. route の隣の置き換え: `_layout` / `_screen` の下の `*.replace.{ts,tsx}`・枠の宣言 `frame.ts`
7. 生成器: 各 `gate.json` の `regions` = `region`、`outputs` = `generated`(最後: 同じファイルなら生成物が効く。`scripts/runner/gates/README.md`)
- scripts の受け口: なし(ドメインのタスク・移行は fork 自身のドメインの `src/features/<ドメイン>/scripts/{tasks,migrations}/`、`src/lib/task/README.md`。常時実行の例外は門番の受け口 src/featureGate/alwaysOnExceptions/ に移った)

区画は生成器の区画なので、fork が自分の受け口の行を足して作り直しても `pnpm workflow ownership check` は通る(検査は基準の区画を読む)。区画の外の行は手書き。一覧の数(`一覧 N`)には数えない。

## ファイル

| ファイル | 中身 |
|---|---|
| `src/lib/districtMap/declarations.mjs` | 宣言の探索とリテラルの読み取り(宣言の唯一の読み手。ここには置かない) |
| `extensions.mjs` | 項目の走査・一覧の組み立て・ずれと手で置いたファイルの検出 |
| `intake.mjs` | 受け口の一覧の生成区画の行 |
| `frames.mjs` | 枠の表(frame.default.ts / frame.ts の解決) |
| `derive/featureTables.mjs` | 組み込みの変換(規則の features → tables・domainApiPaths) |
| `derive/gateSettingPaths.mjs` | 同じ変換の一部(設定の節の feature → settingPaths) |
| `derive/settingRoles.mjs` | setting の上書きは権限を絞るだけ(広げる上書きを止める) |
| `pureImports.mjs` | 値 import の推移の検査と override のキーの読み取り |
| `switches.mjs` / `overrides.mjs` | 1 行スイッチの形、上流の override の検査 |
| `orphans.mjs` / `overrideKeys.mjs` | 孤立の検査(.override・.replace、1 つ)・上書きの対象の点の宣言に無い鍵 |
| `generate.mjs` / `check.mjs` | コマンドの入口 |
