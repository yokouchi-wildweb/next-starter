# 拡張点の生成器(pnpm generate extensions / pnpm check extensions)

## Overview

機能ごとの「差し込み口(拡張点)」を持ち主が宣言し、そこへ置かれた項目の一覧を生成する仕組み。上流の既定の項目も fork の項目も同じ受け口に置き、同じ一覧に並ぶ。ファイル名に fork の名前の印は付けない。fork の物か上流の物かは名前でなく git の分岐点(merge-base)で `pnpm workflow ownership check` が見る(`src/lib/forkOwnership/README.md`)。
src/registry の α(serviceRegistry など)は `pnpm generate registry` / `pnpm check registry` の側で、ここでは扱わない。

## Usage

| コマンド | すること |
|---|---|
| `pnpm generate extensions` | 全宣言を読み、全一覧と受け口の一覧(`intake.txt`)の生成区画を丸ごと書く(問題があれば書かずに止まる)。宣言の消えた古い一覧(目印のヘッダ付き)は消す |
| `pnpm check extensions` | 一覧と生成区画が宣言・項目と一致するか、1 行スイッチの形、孤立した `.replace` / `.override`(1 つの孤立の検査 `orphans.mjs`)・宣言に無い鍵(`overrideKeys.mjs`)、上流が override を持たないかを見る(build の冒頭で走る)。書かない |
| `pnpm test scripts/structure/extensions/` | 生成器の回帰テスト(fixture)と実リポの一致 |

### 宣言(extensionPoints.ts)

持ち主のフォルダの直下に手書きで 1 つ置く(そのフォルダの全拡張点の目次。1 フォルダ 1 宣言)。読み手は `src/lib/districtMap/declarations.mjs` の 1 か所で、生成器・所有の検査の単位名・`src/wiring` の配線テスト・ロールの上書きが同じものを使う。持ち主 = ドメイン(`src/domains/**/<domain>/`)、画面側の点は持ち主の route の `_layout/` `_screen/`、proxy は `src/proxies/`、lib が持ち主の点は `src/lib/<lib>/`。宣言は src の下のどこに置いても読まれる(node_modules・`extensions/` の中は見ない)。

```ts
export const extensionPoints = {
  definitions: {
    change: "add",                                                  // 変え方の型(必須): add 増設点 | override 上書点 | counterpart 対置点 | replace 差替点
    dir: "milestones",                                              // 受け口(持ち主のフォルダからの相対、"." = 直下)
    export: "milestone",                                            // 項目が export する名前(印)
    type: { from: "@/domains/milestone/types", name: "MilestoneDefinition" }, // 一覧の要素の型
    side: "server",                                                 // server | client | shared(読み手の側。今は記録だけ)
  },
};
```

- **change**(必須、地区の議会 D35): 点の変え方の型。欄と合う型だけ書ける(dir・files の受け口と writer の一覧 = `add`、`overrides` = `override`、`placement` = `counterpart`、`default` = `replace`)。無い・合わない点は読み手が止める。段 2 より前の宣言は `.notices/20261122-213044-district-stage2.declarations.mjs` で書き足す
- 宣言 2 段: その地区だけの点はこのファイル、「この種類の地区は全部この点を持つ」点(config.ts ↔ src/config の対置点など)は種類の表(`src/lib/districtMap/kinds.mjs` の `kindPointsOf`)。読み手が 2 つを合わせて地区の地図の `forkCan`(fork ができること)を出す
- **リテラルだけ**で書く: 文字列・真偽・数・配列・object。変数・式・関数呼び出し・テンプレート・spread は失敗(生成器は TypeScript の構文木で字面を読み、実行しない)
- 点の名前 = 一覧のファイル名 = export する一覧の名前。項目の種類の複数形 camelCase(ドメイン名・Registry を付けない)
- fork の拡張点は fork 自身のフォルダ(fork が足したドメイン・lib)の `extensionPoints.ts` に宣言する。上流の持ち主のフォルダには足さない(旧い `extensionPoints.<x>.ts` は生成が止まり、移し方 = 共有の棚の印の移行の notice を案内する)
- 省略できるキーと受け口でない点: API「宣言のキー」
- **型だけの入口**(D33、注文 37): ドメインでない持ち主(lib・枠・proxies・門番・ルート)の点の `type.from` は、その持ち主の `@/<持ち主>/points`(lib は package.json の入口 `"./points"`、ほかは `<持ち主>/points.ts`)だけ。`points.ts` は約束の型だけを出す(`export type` だけ。型の定義は元の場所に 1 つ)。差す側の項目はここだけを型として読む。外れた宣言は `pnpm generate extensions`・`pnpm check extensions` が止める。fork の項目の import は段 3 の道具 `.notices/20261123-040814-district-stage3.points-entries.mjs` が書き換える。ドメインの点は問わない
- **常設の宣言**(ドメインだけ、D22・D53・注文 35): どの機能の規則にも載らず常に開くドメインは、自分の `extensionPoints.ts` に `export const alwaysOpen = true;`(字面の true だけ。点を持たないドメインはこの 1 行だけのファイル)。読み手は同じ `declarations.mjs`、地区の地図の行の `alwaysOpen`。規則の `domains` に載るのに宣言がある・どちらも無いドメインは `pnpm generate district-map` が止める。lib・枠などは宣言できない(門番を持たず閉じない)。点の欄 `alwaysOn`(門番を掛けずに読む一覧)とは別の物

### 差替点(ちょうど 1 つ要る点、D24・D53)

```ts
sender: { change: "replace", default: "src/domains/x/sender.default.ts", type: { from: "@/domains/x/types", name: "Sender" }, side: "server" },
```

- `default` = 上流の既定の出し手(リポジトリ直下からのパス)、`type` = 約束の型、`side`。fork は `<名前>.replace.ts(x)` で差し替える(足して 2 つにしない)。書けるのは change・default・type・side だけ

### plugs の点(差す側の自分のフォルダから集める増設点、D38・D40・D41・D53)

```ts
routeFactoryDevice: { change: "add", plugs: true, export: "plug", type: { from: "@/lib/routeFactory", name: "AnyRouteDevicePlug" }, side: "server", shape: "object", max: 1, target: "wiring" },
```

- 項目は差す側の自分のフォルダ `<ドメイン>/plugs/<点の名前>/<名前>.ts(x)`(フォルダ形 `<名前>/index.ts(x)`。lib の項目は `<lib>/plugs/…`)。差す側 = 地区の地図の domains と lib の地区。fork は上流のドメイン・lib の中に足さず、自分のドメインか lib に置く(intake.txt の行は無い)
- 点の名前はリポ全体で一意(plugs/ の下の点の名前のフォルダで差す先を決める)。plugs/ の直下は点の名前のフォルダだけで、知らない点の名前は止める
- 一覧は配列で、項目 = `{ domain, name, requires, plug }`(`load: "lazy"` は `plug` の代わりに `load: () => import(…)`)。`domain` = 差したドメインのフォルダ名(lib の項目は null)、`requires` = そのドメインの domainEntry の requires。同じ名前は `<差す側>/<名前>` で区別して許す
- 使う時に門番で閉じたドメインの項目を外す: server・proxy は `gate.plugs(list)`、client は `useGate().plugs(list)`(項目のドメインか requires の相手のどれかが閉じていれば外す、lib の項目は外さない)。生成された登録表には掛けない(D26)
- `max` を超える項目の数は生成で止める。空の一覧は `[]` で、点の持ち主が自分の既定で動く(例: API の Factory の端末の点 `gate.plugs(routeFactoryDevice)[0]?.plug` が無ければ lib の「端末なし」、D53)
- ちょうど 1 つの点(`required: true`、`max: 1` と一緒だけ、D53・注文 30): 項目が 0 個なら生成で止める(2 個以上は max が止める)。上流の項目は常設のドメインが差し、1 行スイッチ(`<名前>.ts` → `<名前>.default.ts`)にして項目を差したドメインの extensionPoints.ts に差替点として宣言する。fork は 2 つ目を足さず `<名前>.replace.ts` に向け替える。集める側は素の名前のスイッチを項目にし(export は既定から読む)、`.default`・`.replace` は項目にしない。例: API の Factory の利用者 `routeFactoryUser`・レート制限 `routeFactoryRateLimit`。埋められるのは常設のドメイン(`alwaysOpen`)か lib の項目だけ(閉じうるドメインの項目は生成で止める、注文 35)
- 並び = `<差す側>/<名前>` の順。`order: "declared"` は項目の `export const order = <数>`(字面)→ `<差す側>/<名前>`。`key` の点は字面で読める鍵の全体の一意を生成で止める(どの項目とぶつかったかを出す)
- 書けないキー: `dir`・`ignore`(項目のフォルダは差す側の plugs/<点>/ に決まる)。点の名前は持ち主の名前で始める(段 3、注文 24: userCleanupHandlers・settingFields …。adminBulkActions は core/admin の 1 点)
- 受け口のフォルダの点と同じに使える欄(注文 25): `overrideOf`(上流の項目の隣の `<名前>.override.ts`、files の点は項目のフォルダの中の `<ファイル>.override.ts`。intake.txt に `add src/domains/**/plugs/<点>/…override…` の行)/ `key`(全体で一意)+ `literalKeys`(鍵の字面の union 型 `<点>Key`)/ `shape: "object"`(名前を鍵にした `<点>Map` と型 `<点>Map`。名前は差す側をまたいで一意。plugs の点では `key` と併用できる: 端末の種類は kind の型を `<点>Map` から導く、注文 27)/ `derive`・`pureImports`・`requireText`(plugs の項目にも効く)/ `files`(項目 = フォルダ、plug に `folder`)/ `alwaysOn`(常に読む一覧: 読み手は gate.plugs を掛けず、項目の enabled が自分で閉じる)。一覧はどれも `{ domain, name, requires, plug | load }` の配列で、使う時に門番で絞ってから鍵の表を作る。保存した行の鍵の定義(設定の欄・保管の用途・財布の履歴の理由・紹介報酬のグループの表示)は登録表と同じく絞らない(D26)。server と client の両方から呼ぶ組み立て器は絞り `PlugsFilter`(`@/featureGate/client` の型)を引数で受ける
- `itemsOf: "<点>"`(files と一緒に): 同じ宣言の files の plugs の点の項目のフォルダ(plugs/<その点>/<名前>/)の別のファイルを読む点。1 つの項目のファイルを 1 か所に保ち、側(server・client)の違う一覧を分けて出す(例: 連絡のレイアウト messagingLayouts の layout.ts と、itemsOf の messagingLayoutEmails の email.tsx・messagingLayoutInApps の inApp.tsx)

### 選ぶ点(口の実装を 1 つ選ぶ plugs の点、D9・D17・D36)

- 宣言: `change: "add"` の plugs の点に `select: { port, optional?, words, compat }` を足すと選ぶ点になる(変え方の型は増設点のまま。fork が書く所は項目(型 3)と選択表(型 5 self))
  - `port` = 口の名前(選択表の鍵。口の全部の点が同じ名前の項目を選ぶ)、`optional: true` = 選択表に `"none"` を書ける口(口の点で揃える)、`words` = 能力の語(能力の名前は `<口>.<語>`)、`compat` = 今の設定の読み方(`{ from: "env", name, map, default }` | `{ from: "fixed", value }`、移行の道具が読む)
  - `export` は `"adapter"`。書けるのは change・plugs・export・type・side・select・pureImports だけ(一覧の欄 target・load・key・shape・max・required などは書けない)
  - 持ち主は lib か常設のドメインだけ(D10)。項目を置けるのは、持ち主が lib なら lib だけ、常設のドメインならそのドメインか lib
- 項目: `<持ち主か lib>/plugs/<点>/<名前>.ts`(か `<名前>/index.ts`)に字面だけの `export const declaration = { provides, requires, billing, env }`(型 `BackendDeclaration`、`@/lib/backends`)と本体 `export const adapter`。宣言は構文木で読み、実行しない(読み手 `readBackendDeclaration`、`src/lib/districtMap/declarations.mjs`)。名前 `none`・`fake` は予約(`src/lib/backends/reserved.ts` を字面で読む)
- 能力の語: 選ぶ点の `select.words` と、増設点 `backendCapabilities`(`src/lib/backends`)の項目 `export const capabilities = { port, words }`。同じ語の 2 度目・在らない口への語は止める
- 要る能力: ドメインは同じドメインの `extensionPoints.ts` に `export const backendRequirements = ["<口>.<語>", …]`(字面、ドメインだけ)。開いているドメイン(常設か、載せる規則のどれかが開)の分だけ数える。どの規則にも載らず常設でもないドメインは閉で数えない。開閉は段階のランナーと同じ `scripts/runner/phases/features.ts`(env `GATES_FEATURES` がテスト用)で、要る時だけ読む
- 選択表: 根の `backend-selection.json` = `{ "<口>": "<実装の名前>" }`。生成器が選ぶ点ごとに `<持ち主>/extensions/<点>.ts` へ選んだ 1 項目の `export { adapter } from "<項目>";` を書く(選ばない実装は読まない)。`"none"` は `createNoneAdapter<型>("<口>")`(`@/lib/backends`)
  - 同じファイルに `export const selected = "<名前>" as const;`(選んだ名前)と `export const compat = <宣言の select.compat の写し> as const;` も書く(使う時の食い違いの守りが読む。宣言そのものは実行時に読まない)
  - 持ち主の中の項目と型(`type.from`)は相対で読む(閉じた lib の単体の tsconfig は自分の `@/lib/<名前>` を解かない)、ほかは `@/`
- 起動時の知らせ(D49): 点 `startupTasks`(`src/lib/startup`)が在れば、選ぶ点ごとに `src/wiring/startup.ts` の一覧へ 1 行を足す(項目のファイルは作らない)
  - 行 = `{ domain: null, name: "<点>BackendStatus", requires: [], load: async () => { if (process.env.NEXT_RUNTIME === "nodejs") { const { createBackendStatusTask } = await import("@/lib/backends"); const { <点>BackendStatus } = await import("<持ち主の公開の入口>"); return createBackendStatusTask(<点>BackendStatus); } return { name: "backends.<口>", runtime: "nodejs", run: () => {} }; } }`(起動ごとに選んだ実装の `isConfigured` を 1 行、投げない、env の値を出さない)
  - 読みは `NEXT_RUNTIME === "nodejs"` の中だけ(Next の instrumentation の runtime ごとの読み方): 一覧は edge の束にも入るので、条件の外で読むと持ち主の入口の Node 専用の物(mail なら webhook の `node:crypto`)が edge に入り Edge Runtime の警告になる。edge では走らない同じ名前の項目を返す
  - 持ち主の公開の入口(lib は `./server` を宣言していればそれ、無ければ `.`、ドメインは `services/server`)が口の状態 `<点>BackendStatus` = `{ port, selected, isConfigured }`(型 `BackendStatus`、`@/lib/backends`)を出す。送れる `adapter` は出さない。入口が出さなければ止める
  - 公開の入口だけを名前つきの dynamic import で読むので、`entry/only-entries`・`mail-send-via-messaging` の決まりのまま通る。選択表に問題がある間も行は変わらない
- 止める(生成と `pnpm check extensions`、build の段でも): 選択表が無い・読めない・鍵の欠け・知らない口の鍵・知らない値・`"fake"`・任意でない口の `"none"`・口のどれかの点に選んだ名前の項目が無い・選んだ実装の requires を選んだ実装の provides の和が満たさない・開いているドメインの要る能力を満たさない・項目の宣言の形(D29 の鍵だけで全部要る、billing の `"none"` は単独、`"usage"` は unit)・知らない語・ほかの口の provides・`<持ち主>/extensions/<点>.default|replace` の手置き。文言は直し方(`pnpm workflow backend-selection fill` / `set <口> <名前>`)を示す
- env の食い違い(段 build・ship だけ、env `PHASE`。段の無い `pnpm generate extensions` と選択表の命令は見ない): `compat` が `from: "env"` の口で、その env が在り空でなければ `map` で名前に写し(鍵でない値は `default`、使う時の守りと同じ)、選んだ名前と違えば止める。文言は 2 つの実装の名前と直し方(`set <口> <名前>` か env を消す)だけで、env の値は出さない
- env の欠け(段 build だけ、止めない): 選んだ実装の宣言の `env.required` のうち env に無い名前を 1 行(`warn:`)。offline の段で runner が外す名前(`scripts/runner/phases/offlineEnv.mjs` の `OFFLINE_ENV`、例 `RESEND_*`)は見えないので数えない(起動時の知らせが見る)。ship は手元の shell の env で配る先の env でないので見ない
- 選ぶ点が 0 個なら選択表を読まず、何も書かず、止めない
- 選択(選択表・選ぶ点の項目)に問題がある時: `pnpm generate extensions` は選ぶ点でない一覧(`src/wiring/startup.ts` ほか)と可変域の区画を書き、選ぶ点の生成物(`<持ち主>/extensions/<点>.ts`)は今のまま残して、問題を出して止まる(取り込みの直後の `{}` でも生成物の衝突を作り直せる。起動時の知らせの行は一覧に残る)。選ぶ点でない問題があれば今どおり何も書かない。`pnpm check extensions` は問題で落ち、その間は選ぶ点の生成物を「宣言の無い古い一覧」に数えない

### 項目

受け口(`dir`)の直下に、次の 2 形のどちらかで置く。名前は英字始まりの英数字で、上流の項目も fork の項目も印なし。並び = ファイル名の順(Tier の順は使わない)。

- ファイル: `<名前>.ts(x)`
- フォルダ: `<名前>/index.ts(x)`(中の index が項目、ほかのファイルは部品)

受け口のフォルダが無い点は項目 0(一覧は空)。印 = `export const <export>` の形(字面で見る。`export { x as <export> }` は拾わない)。項目のファイルは生成器から import しない。

鍵の重複: 項目の一意の名前(`key` の点のほか purchaseType・jobType・rewardKey・用途 ID など)が 2 つあれば読み手が例外を投げる。ファイル名の順で後が勝つ差し替えは無い。上流の組み込み項目を差し替えたい fork は、上流へ 1 行スイッチを依頼する(`/order`)。

### 1 行スイッチ(画面以外の、1 つだけの実装を差し替える口)

型 1(丸ごと替える、Extension「4 つの型」)のコードの側。一覧に並べるのでなく「どれか 1 つ」を使う実装(決済の enricher など)は、既定の隣に 1 行のスイッチを置く。

| ファイル | 中身 | 持ち主 |
|---|---|---|
| `<名前>.ts(x)` | 呼び手が import する素の名前。`export … from "./<名前>.default";` の re-export 1 文だけ | 採用者(fork が `./<名前>.replace` に書き換える) |
| `<名前>.default.ts(x)` | 上流の既定の実装 | 上流 |
| `<名前>.replace.ts(x)` | fork の丸ごと置き換え(既定と同じ export の形) | 足した Tier |

- 宣言(差替点、宣言 2 段の 1 段目): 既定を中に持つ地区の `extensionPoints.ts` に `<点>: { change: "replace", default: "<既定のリポジトリ直下からのパス>", type: { from, name }, side }` を書く。点の名前 = スイッチの名前の先頭を小文字、`type` = 約束の型(既定が export する `<名前>Props` など)。`default` は宣言した地区の dir の中(枠の地区の宣言だけは src/app の下を通す: 枠の部品はルートの隣にもある。例 root の枠の `forkProviders` = `src/app/_providers/ForkProviders.default.tsx`)。fork の自前の既定は段 2 の移し替えの道具 `.notices/20261122-213044-district-stage2.declarations.mjs` が書く(側・持ち主が決まらない物は `--side` / `--owner` で決める)
- Tier が自分で足した差替点(上流のルートの `_components/` の自分の部品の `<名前>.default` + スイッチ、例 fork が下のリポに枠のヘッダーの見た目を替えさせる): 宣言はその Tier 自身の `src/app/<ルート>/_components/extensionPoints.ts`(持ち主 = その `_components/`、`default` はその中)、約束の型は同じフォルダの型だけの入口 `src/app/<ルート>/_components/points.ts` から(D33)。上流の `_layout/extensionPoints.ts` には書かない(上流の持ち物)。読み手・生成器は他の宣言と同じに読む(宣言 2 段の 1 段目、地区の地図には載らない)。下のリポは `<名前>.replace` で替え、中間の Tier の宣言を直さない。段 2 の道具はこの置き場を自分で選ぶ
- 多段: 下の Tier は同じスイッチを書き換える(親の実装を使い続けるなら触らない)
- page.tsx の 1 行スイッチ(`_screen` / `_components` を指す)・枠の layout.tsx の 1 行スイッチ(`_layout/<Layout>` / `_layout/<Layout>.replace` を指す)は別の仕組み(`src/lib/screens/README.md`、`pnpm test scripts/structure/routes/screens.test.mjs`)

### override(既定を変える隣のファイル)

型 2(一部を重ねる、Extension「4 つの型」)の仕組み。

- 一部の上書き(丸ごと置き換えは `.replace`)。対象ごとに 1 本: `<対象>.override.ts(x)`(例 `domainEntry.override.ts`・`user.role.override.ts`・`user.profile.override.ts`)、cron は task.ts の隣の `src/app/api/cron/<name>/task.override.ts`(旧名の素の `override.ts` は `scripts/structure/cron/discover.ts` が改名を案内して止める)。Tier 別・fork の名前付きのファイルは作らない
- 上の Tier の物にだけ置ける: fork が足した override の対象が基準に無ければ `pnpm workflow ownership check` の override-own
- 足した Tier の物。下の Tier は同じファイルを書き換える: 受け継ぐ = 触らない / 既定へ戻す = キーを消すかファイルを消す / 全部を戻す = 空(空白とコメントだけ = 不在と同じ)。合成は git の merge だけ
- **上流(Tier1)は override を出荷しない**(空のものも)。既定は既定の場所に書く。検査: `pnpm check extensions`(`overrides.mjs`)

## API

### 宣言のキー

- 省略できるキー:
  - `plugs: true` … 項目を差す側の `<ドメイン>/plugs/<点の名前>/` から集める増設点(上の「plugs の点」。`dir` の代わり)。`itemsOf: "<点>"` … 同じ宣言の files の plugs の点の項目のフォルダを読む(上の「plugs の点」)
  - `max: <1 以上の整数>` … 増設点の上限(plugs の点は超えたら生成で止める。空なら点の持ち主の既定で動く、D24・D53)
  - `required: true` … plugs で `max: 1` の点だけ。項目がちょうど 1 つ要る(0 個は生成で止める。上の「plugs の点」のちょうど 1 つの点)
  - `order: "file" | "declared"` … 増設点の順位の並び(plugs の点: <差す側>/<名前> の順 / 項目の `export const order`。意味がある点だけ)
  - `key: "<プロパティ>"` … 一覧を `Record<string, T>` にする(各項目の値のそのプロパティが鍵。重複は読み込み時に例外。null プロトタイプなので外から来た名前で引いても `constructor` などに当たらない)
  - `literalKeys: true` … `key` と一緒に使い、鍵の文字列を一覧の型に残す(項目の型が鍵を文字列リテラルで持つこと。登録済みの名前の union を型で導く点)
  - `keyPrefix: "district"` … plugs の点で `key` と一緒に使い、項目の鍵の字面を `"<差した地区の名前>.<名前>"` に縛る(先頭が項目を置いた地区でない・字面で読めない鍵は生成で止める、`plugs.mjs`)。例 送り箱の処理の `kind`(`src/domains/core/outbox`)
  - `load: "lazy"` … 項目を import せず `{ name, load: () => import(…) }` の配列にする(必要なときだけ読む。key・derive とは併用不可)
  - `target: "wiring"` … 一覧を `src/wiring/<持ち主のフォルダ名>.ts` に出す(lib が持ち主の点。同じ lib の点は 1 本にまとめる)
  - lib の結び目 `export const wire = { name, export, side, registers? }`(同じ extensionPoints.ts、点の外に 1 つ、D31): `target: "wiring"` の plugs の点の一覧と一緒に、`src/wiring/<lib>.ts` の末尾に結び目を書く。一覧は門番で閉じたドメインの項目を外してから渡す(D26)
    - `side: "server"` → `export const <export> = <name>({ <点>: gate.plugs(<点>), … })`(`<name>` は lib の入口 `@/lib/<lib>` が出す作り手。例 `serverErrorReport` = `wireServerErrorReport(…)`)
    - `side: "client"` → ファイルの先頭に `"use client"`、子を包む部品 `<export>` が `<name>`(lib の Provider)に `{ <点>: useGate().plugs(<点>), … }` を渡す(例 `FormInputsRoot` → `FormInputsProvider`)
    - `registers: "<interface>"`(client だけ、key を持つ点と一緒)… 項目の key の字面(全体で一意)を lib の interface に広げる(`declare module "@/lib/<lib>"`、例 `RegisteredFormInputs`)
    - 止める物: 未知のキー・識別子でない name / export・side が server | client でない・registers が client でない、`target: "wiring"` の plugs の点の無い lib の wire、key の点の無い registers
    - wiring どうしは読まないので(D32)、複数の読み手が要る結び目(失敗の記録など)はここで生成物に置く
  - `ignore: ["<ファイル名・フォルダ名>", …]` … 受け口の直下にある、項目でないファイルとフォルダ(骨組みのファイルなど)
  - `files: "*/<ファイル名>"` … 受け口の 1 段下の決まった名前のファイルが項目(デモの `*/_demo.ts`)。項目名 = フォルダ名で、一覧の各項目に `folder: "<フォルダ名>"` が付く(一覧の型は `folder` を持つ)。ファイルの無いフォルダは項目でない。フォルダの名前に fork の印は付けない
  - `shape: "object"` … 一覧を `{ <項目の名前>: 項目 }` の null プロトタイプの object で出す(キーを型に残す。`load`・`files` とは併用不可、`key` は plugs の点だけ併用可)。同じ名前は失敗
  - `pureImports: true` … 項目から値 import を推移的に辿り、`zod` と src の下の純関数・値以外(react・next・server-only・サービス・部品・DB の定義)へ届いたら失敗。型だけの import は辿らない(`pureImports.mjs`)
  - `requireText: "<字面>"` … 項目のファイルにその字面が無ければ失敗(setting の `.default(`)
  - `overrideOf: ["<属性>", …]` … 項目の隣の `<名前>.override.ts` の `export const override = { … }` を一覧に重ねる(一部の上書き)。書けるのは挙げた属性だけ。対象の項目が受け口に無ければ失敗(孤立)、`overrideOf` の無い点の受け口に置いた override も失敗。上の Tier の項目にだけ置ける(fork が自分で足した項目への override は `pnpm workflow ownership check` の override-own。fork の項目は直接書き換える)。上流は出さない(`overrides.mjs`)。空のファイルは不在と同じ
    - `files` の点の `overrideOf`: 項目のファイルの隣の `<ファイル名>.override.ts`(例 `layouts/<名前>/layout.override.ts`)を重ねる(`{ ...項目, ...override, folder }`)。鍵の検査は同じ、項目のファイルの無いフォルダの override は失敗、`overrideOf` の無い files の点の項目のフォルダに置いた override は孤立の検査が止める。intake は `add <dir>/*/<ファイル名>.override.{ts,tsx}`
    - `overrideRefuse: { flag, key, value }`(plugs の点で overrideOf と一緒、key は overrideOf の中): 項目の export が `<flag>: true` を字面で持てば、その override に `<key>: <value>` を字面で書くと生成と `pnpm check extensions` が止める(例 lib/cron の expiryRules: `pii: true` の削除に `enabled: false` は書けない、pii_prune_kept)
  - `alwaysOn: true` … 常に読まれる処理(cron・退会など)から走る点の印。項目が機能を閉じる規則のフォルダを import するなら項目に `enabled` が要る(`FEATURE_GATE_CHECK=all pnpm test src/featureGate scripts/structure/proxies`)
  - `derive: "settingSections"` … 組み込みの検査。項目の `section:` が同じ持ち主の点 `sections` の `key:` にあるかを見る。上書きが権限を広げないか(キー・セクションの `allowRoles` と `ui.section` を字面で読み、重ねる前と後の実効の権限を比べる)も見る(`derive/settingRoles.mjs`)
  - `derive: "featureTables"` … 組み込みの変換。機能を閉じる規則の `domains` のフォルダ(旧名 `features` は止めて案内する)(ドメインの位置 `core/<名前>` か `<名前>`。
    - 無い・位置でない書き方は止める)から `tables`(表を持たないドメインは空)と汎用 API の住所 `domainApiPaths`(フォルダの `domainEntry.ts` のキー → `/api/<キー>`)と設定の節の住所 `settingPaths`(節の `feature` → `/admin/settings/<key>`、`derive/gateSettingPaths.mjs`)と cron の task の住所 `cronPaths`(`src/app/api/cron/<名>/task.ts`・`task.override.ts` の値の import が `domains` のフォルダに当たる → `/api/cron/<名>`。
    - 規則に手書きした `/api/cron/` は止める)を導き(`tables`・`domainApiPaths`・`settingPaths`・`cronPaths` は説明用で `pathPatterns` に足さない)、生成一覧にドメインの表 `domains`(フォルダ・表・汎用 API の住所・持つ機能)・cron の task の表 `cronTasks`(住所・読むドメイン)・設定の節の表 `settingSections`(住所・名指す機能)を出し(開閉はドメインの開閉と節自身の判定、`src/featureGate/Internals.md`「ドメインの開閉(表・汎用 API・cron)と設定の節」)、規則の `dependsOn`(機能の名前の文字列リテラルの配列)を字面で読んで `dependsOn` に写し(書かない規則は空。
    - 非リテラル・自分・重複・未知の名前・輪は止める、`derive/gateDependsOn.mjs`)、項目の名前(ファイル名)を `name` に付け、名前の union `export type FeatureName` も出す(`derive/featureTables.mjs`)。fork が変換を足す口は無い
    - 規則の `when`(`"<ドメイン>.<名前>"` の文字列リテラルの配列)を字面で読み項目に写し、指されたドメインの config.ts の最上位の真偽の export を確かめ(知らない名前・真偽でない値は止める)、指された config.ts だけを import する `extensions/whenInputs.ts` を書く。規則のファイルの値の import(import type 以外)と住所のパターンの誤り(`@/lib/pathPattern` の `patternProblem`)も止める(`derive/gateWhen.mjs`、D23・D28)
- 受け口でない点(一覧はこの生成器が書かない。受け口のフォルダの行も無い。判定 `isListPoint`):
  - `writer: "role:generate"` + `side` … 一覧を別の生成器が書く点(ロール・プロフィール)
  - `placement: "<置き場の glob>"` + `kind: "edit" | "append"` … 置き場の点(型 4)。fork が書いてよい場所(リポジトリ直下から、`src/` 始まり)とその書き方。受け口の一覧の行になるだけ(項目も一覧も無い)
  - `overrides: "<対象のファイルの glob>"` + `export: "<上書きの export の名前>"` + `side` + `overrideOf: [...]`(+ `keyedBy: "<対象の export>"`)… 上書きの対象の点。glob はリポジトリ直下から(`src/` 始まり、`..` 無し)。対象(ロール・プロフィールの JSON・cron の `task.ts`・`domainEntry.ts`・連絡の定義 `messages/*.ts`)の隣の `.override.ts` が書いてよい鍵を `overrideOf` で名乗る。`addable: true` = fork が同じ場所に対象を足してよい(ロール・プロフィールの JSON)。
    - 宣言は `as const` で書き、上書きの型(`RoleOverride` など)は `overrideOf` から引く(`(typeof extensionPoints.<点>.overrideOf)[number]`)。読み手(`scripts/structure/role/overrides.mjs`・`src/lib/cron/discover.ts`・`scripts/structure/registry/serviceRegistry`)は自前の鍵の一覧を持たず `overrideKeysOf`(`src/lib/districtMap/declarations.mjs`)で読み、値の検査だけを持つ。安全の制限(core ロールの `enabled`・プロフィールの `fields`)は「宣言に鍵が無い」で表す

## Extension

### fork が上流の物を変える 4 つの型

fork が上流(親の Tier)の物を変える方法はこの 4 つだけ。印は `.default`・`.replace`・`.override` の 3 つで、上流が置く物は印なし(素の名前)。表はここだけに置き、ほかの README と `.claude/rules/core/change.md` はここを指す。

| 型 | 上流が置く物 | fork が書く物 | 見分け | who の type |
|---|---|---|---|---|
| 1 丸ごと替える(コード) | `<名前>.default.ts(x)` + 隣の素の `<名前>.ts(x)`(1 行スイッチ)/ 画面・枠: 表の下 | `<名前>.replace.ts(x)` にしてスイッチを向け替える / 画面・枠: 表の下 | 隣に `.default` がある・ルートの `page.tsx` / 枠の `layout.tsx` | `1` |
| 2 一部を重ねる(データ) | 素の実体 + 重ねてよい鍵の宣言(`extensionPoints.ts` の `overrideOf` / `overrides`)/ 枠: ルートを作ったリポが隣に `frame.ts` | `<対象>.override.ts`(宣言の鍵だけ)/ 枠: 下のリポは上流の `frame.ts` の有無に関わらず `frame.override.ts`(キー `layout`・`page` は隣にある範囲だけ) | 上位の `extensionPoints.ts` に上書きの宣言がある・src/app のルート | `2` |
| 3 足す | 宣言された受け口のフォルダ(`extensionPoints.ts` の `dir`) | そのフォルダに素の新しい名前の項目 | 上位の `extensionPoints.ts` に受け口の宣言がある | `3` |
| 4 置き場で分ける(値) | CSS: `src/styles/core/<名前>.css` / 設定: 持ち主の `config.ts`(`config.ui.ts`) | CSS: 直下の `src/styles/<名前>.css` / 設定: `src/config/{lib,domains,layout,proxies}/<名前>.config.ts` に変えたいキーだけ | 宣言の `placement` に当たる・地区の `config.ts` | `4` |
| 変えられない | — | 書かない → `/order <直接の親>`(要るまでは一時許可) | どれにも当たらない | `none` |

- 型 1 の画面: 上流は `page.tsx` がスイッチ、既定は `_screen/`。fork は `<ルート>/_components/` に `<X>Screen.tsx`(と fork の部品)を置き、`page.tsx` を向け替える
- 型 1 の枠: 上流は `layout.tsx` がスイッチ、既定は `_layout/<Layout>`。fork は既定の隣に `_layout/<Layout>.replace.tsx` を置き、`layout.tsx` を向け替える(fork の枠の部品はルートの `_components/` に印なしの名前)

- 見分けの順: 隣に `.default` = 丸ごと / 上位に宣言 = 重ね・足す / 置き場の宣言 = 置き場 / どれも無い = 変えられない。どのパスも `pnpm workflow ownership who <path>` で確かめる(答えの type = `1`〜`4` | `generated`(生成物: 直す元を直して作り直す)| `own`(自分の物・中間 Tier の物: そのまま書く)| `none`。判定の順と答えの形: `src/lib/forkOwnership/README.md`「型の答え(`explain.mjs`)」)
- コードの一部だけを重ねる手段は無い。要るなら上流が値(config・value prop)・受け口・部品の分割で外へ出す(`/order`)
- 安全の制限は「宣言に鍵が無い」「広げる上書きを止める」で保ち、重ねでも弱めない: 管理メニューの `allowRoles` は絞るだけ・core ロールの `enabled` は不可・プロフィールの `fields` は不可・setting の schema は不可(setting の `allowRoles` は絞るだけ、`derive/settingRoles.mjs`)
- 違反(`pnpm workflow ownership check`): 親の物の隣に `*.default.*` を足す(`default-add`)・親の `.default` を書き換える(`default-edit`)・上流のルートの隣に素の `frame.ts` を置く(`frame-plain`)。`frame.default.ts` はどの Tier でも生成器が失敗にする。自分の領域の自分の `.default` は中間の Tier も出してよい

## Internals

### 項目の名前と失敗

名前の決まり(1 行スイッチの `<名前>.default` ↔ 素の名前 ↔ `<名前>.replace`、ほかの仕組みが名乗る `.default`、`<対象>.override.ts` ↔ 対象、枠の宣言の `frame.ts` / `frame.override.ts`)の元は `src/lib/districtMap/extensionNames.mjs` の 1 か所(この下の検査と `pnpm workflow ownership who` が読む。who は scripts を読めないので src/lib に置く)。
点つきの名前の分類は `src/lib/districtMap/dottedNames.mjs` の 1 か所(`.default` / `.replace` / `.override` / `.client` / `.test` / それ以外 = 旧い fork の名前の印)。受け口で許すのは印なしの名前と、`overrideOf` の点の `<名前>.override.ts` だけ。`<名前>.replace` は 1 行スイッチの置き換えで、受け口の項目ではない(下の孤立の検査)。

失敗(書き出さない): 旧い fork の名前の印(`<名前>.<x>.ts`・`<名前>.<x>/`。印なしの名前への改名と移し方 = 共有の棚の印の移行の notice を案内する)/ 印(export)が無い(受け口に置くのは項目だけ。部品は責務のドメインへ)/ 同じ受け口の 2 つの点の印を両方持つ / index の無いフォルダ / 同じ名前のファイルとフォルダ / 名前の形。テスト(`*.test.*`)・`.d.ts`・`.ts(x)` 以外・`extensions/`・ほかの点の受け口のフォルダは見ない。

上流と同じ単位名(`x.ts` と `x.tsx`、ファイルとフォルダ)の fork の追加は、生成器ではなく `pnpm workflow ownership check` の unit-clash が止める(git の分岐点が要るため。build の生成器は git を使わない)。

### 一覧(生成物)

- 置き場: `<持ち主>/extensions/<点>.ts`(`target: "wiring"` は `src/wiring/<lib>.ts`)。中身は全部生成物で、1 行目は共通の目印「`// 生成物・編集不可: pnpm generate extensions が <宣言のファイル> から生成する`」
- 項目の import は `@/…` の形(拡張子・フォルダの index を除く)。import の別名は `<点の名前>_<項目の名前>`(1 本の wiring に別の点の同じ名前の項目が混ざっても、予約語の項目名でも衝突しない)
- `extensions/` の下に宣言に無いファイルがあれば `pnpm check extensions` が失敗する: 目印の無いもの = 手で置いたファイル(「受け口は <dir>」と示す)、目印のあるもの = 宣言の消えた古い一覧(`pnpm generate extensions` が消す)
- 生成物はコミットする。/flux で上流を取り込んだら作り直してコミットし、衝突はどちらかを採って作り直す
- 所有: `src/**/extensions/**` は intake の generated 行。受け口のフォルダへの fork の追加は intake の生成区画の add 行(下)

### 1 行スイッチの検査

- 検査(`pnpm check extensions`、`switches.mjs`): スイッチの組は差替点の宣言から得る(読み手 `src/lib/districtMap/declarations.mjs` の `replacePointsOf`)/ 木の `<名前>.default.ts(x)` で差替点の宣言の無い物・宣言の `default` が無い・`<名前>.default.ts(x)` の形でない・宣言した地区の外を指す・同じ既定を 2 つの点が指す、は止める / 既定の隣にスイッチが要る / スイッチはコメントを除いて re-export 1 文だけ / 指す先は `<名前>.default` か `<名前>.replace` で実在する(旧い fork の名前の印つきの先は止めて移し方を案内する)/ 上流(Tier1)のスイッチは `.default` を指す / 孤立した `<名前>.replace` は下の孤立の検査
- `.default` は作ったリポが出す既定の共通の印で、1 行スイッチだけの物ではない。`.default` を使うほかの仕組みは自分のファイルの形を 1 か所で公開し(例 `frames.mjs` の `CLAIMED_DEFAULTS` = `src/app` の `frame.default.ts`: 枠の宣言は `.default` を使わず frames.mjs が失敗にするが、スイッチの既定と取り違えさせないため名乗る。形 `{ by, under, name | pattern }`)、`switches.mjs` の `CLAIMERS` に足す。名乗った形はスイッチの既定として扱わない

### override の検査

- 孤立の検査は 1 つ(`orphans.mjs`、全 Tier): src の下の `<対象>.override.ts(x)` と `<名前>.replace.ts(x)` を 1 回の走査で集めて照らす
  - `.override`: 受け口のフォルダ(`overrideOf` の点。項目と照らすのは `extensions.mjs`)か、上書きの対象の点(宣言の `overrides` の隣の glob)で隣に対象があること。どちらでもなければ「受ける点が無い」、対象が無ければ孤立。空は不在と同じで見ない
  - `.replace`: route の `_layout` / `_screen` の中は、そのルートの page.tsx / layout.tsx の 1 行スイッチの向け先か、隣に `<名前>.default` があること(`src/lib/screens` の `findRouteReplaceProblems`)。隣に印なしの部品があるだけの `.replace` は置き換えの口でない: fork の部品はルートの `_components/` に印なしの名前で置く。それ以外の場所は隣に `<名前>.default`。`_components/` の中は見ない
  - 宣言に無い鍵(`overrideKeys.mjs`): 上書きの対象の点の上書きの export(宣言の `export`)のキーは `overrideOf` の中だけ。`keyedBy` の点(domainEntry)はキーが隣の対象のその export のキーの中だけ、値は宣言の 1 つの属性。値の検査は各読み手(ロール・cron・tsc)
- 生成器・検査は空のファイルと不在を同じに扱う(cron の `src/lib/cron/discover.ts`・`scripts/structure/registry/serviceRegistry/discover.mjs`)

### 枠の表(frame.ts / frame.override.ts の宣言から)

型 2 の枠の側(Extension「4 つの型」)。

- `src/app` の `frame.ts`(ルートを作ったリポの宣言、`frame`)と `frame.override.ts`(その下のリポの宣言、`override`。相手 = そのルート、`frame.ts` の上に重なる)を `frames.mjs` が字面で読み(`literalOf`)、親の鎖を解決した表を枠の根ごとに `<枠の根>/_layout/extensions/frameTable.ts` へ書く(`src/app/(user)`・`src/app/admin`。一覧の数に入る)。範囲はキー `layout` / `page` で名指す。宣言の書き方・重ねる順・表の形: `src/app/_layout/frame/README.md`
- 失敗: 枠の外・隣に layout / page が無い・`layout:` / `page:` の相手が無い・キーが無い・知らないキー・private / @slot / intercepting の下・形の違う値・宣言にない部位・`frame.default.ts`(どの Tier でも)・ほかの名前・上流(Tier1)の `frame.override.ts`。全部の部位を隠す宣言は warn(止めない)
- 親のルートの隣に fork が印なしの `frame.ts` を足すのは `pnpm workflow ownership check` の frame-plain(git の分岐点が要るので生成器は見ない)。親のルートの隣の `frame.override.ts` は intake の `add` 行
- 名前の移し替え: `pnpm check extensions -- frames-move [--base <rev>] [--apply] [--json]`(`framesMove.mjs`、既定 dry-run): 親のルートの隣の fork の `frame.ts` → `frame.override.ts`、fork 自身の `frame.default.ts` → `frame.ts`

### 受け口の一覧の生成区画(intake.txt)

`src/lib/forkOwnership/intake.txt` の `# === AUTO-GENERATED intake START ===` 〜 `END` の間は `pnpm generate extensions` が書き、ずれは `pnpm check extensions` が止める。行を組むのは宣言 2 段の読み手 `src/lib/districtMap/intakeRows.mjs`(`intakeRowsOf`、ファイルを読まない)で、`intake.mjs` は木から入力(宣言の点・差替点のスイッチ・ルート・phase.json)を集めて呼ぶだけ(区画の差し替えは `src/lib/forkOwnership/intake.mjs`)。src の下の行は全部ここ。行の種類は手書きだったときと同じ(下の Tier の書き換えの判定が変わらない。`intakeFromDeclarations.test.mjs`)。並び(最後に当たった行が効く):

1. 置き場(placement の点): `<kind> <glob>`
2. 画面: ルートの `page.tsx`(`src/lib/screens/routeTree.mjs` の discoverRoutes = ルートの地図と同じ見つけ方を src/app から直に。`pnpm generate routes` を待たない)と枠の 1 行スイッチの `layout.tsx`(parseSwitchLayout)= `edit`。種類の表の「ルート = page.tsx の差替点・枠 = layout の差替点」(D35 (ii))は、地区と 1 対 1 でない(ルートごと)ので差替点の宣言にせず、読み手がルートの一覧を入力に取って満たす(地図の枠の地区の forkCan には `kindPointsOf` の `layout` が載る)。パスの `[slug]` などは `[[]`・`[]]` で包む(`literalGlob`、node:path の matchesGlob の字の組)
3. 宣言の受け口のフォルダ: `add <dir>/*.{ts,tsx}` とフォルダ形 `add <dir>/*/**`(files の点は `add <持ち主>/*/<ファイル名>`)
4. 差替点(1 行スイッチ): 素の名前 `edit <dir>/<名前>.ts(x)`(向け先を替える)と置き換え `add <dir>/<名前>.replace.{ts,tsx}`。理由の字に差替点の名前と宣言の場所
5. 上書きの対象の点(`overrides`): 隣の上書き `edit <glob の最後の拡張子を .override.ts に>`(多段で下の Tier が親の上書きを書き換える)、`addable` の点は対象そのものも `add <glob>`
6. route の隣の置き換え: `_layout` / `_screen` の下の `*.replace.{ts,tsx}`・下のリポの枠の宣言 `frame.override.ts`
7. 生成器: 各 `phase.json` の `regions` = `region`、`outputs` = `generated`(最後: 同じファイルなら生成物が効く。`scripts/runner/phases/README.md`)
- scripts の受け口: なし(ドメインのタスク・移行は fork 自身のドメインの `src/domains/<ドメイン>/scripts/{tasks,migrations}/`、`src/lib/task/README.md`。常時実行の例外の置き場は無い: 前の scripts/proxies/alwaysOnExceptions と src/featureGate/alwaysOnExceptions・dependencyExceptions は生成器が止める、注文 36)

区画は生成器の区画なので、fork が自分の受け口の行を足して作り直しても `pnpm workflow ownership check` は通る(検査は基準の区画を読む)。区画の外の行は手書き。一覧の数(`一覧 N`)には数えない。

### 役目

- 宣言の探索とリテラルの読み取り(宣言の唯一の読み手)は `src/lib/districtMap/declarations.mjs`(ここには置かない)
- `extensions.mjs` 項目の走査・一覧の組み立て・ずれと手で置いたファイルの検出 / `plugs.mjs` plugs の点の項目の走査(差す側の plugs/、上限・順位・鍵の一意)/ `intake.mjs` 受け口の一覧の生成区画の入力(行は `src/lib/districtMap/intakeRows.mjs`)/ `frames.mjs`・`framesMove.mjs` 枠の表・名前の移し替え
- `derive/featureTables.mjs`・`derive/gateSettingPaths.mjs` 規則の features → tables・domainApiPaths・settingSections / `derive/gateDependsOn.mjs` dependsOn の字面の読みと検査 / `derive/gateWhen.mjs` when の読みと検査・whenInputs の生成・規則の値の import の検査 / `derive/gateRequires.mjs` requires の被覆の検査(機能のドメインの requires の先が自分・依存先・常設のどれか)/ `derive/settingRoles.mjs` setting の上書きは権限を絞るだけ
- `derive/messageGuards.mjs` 止められない連絡(required)の守り: 連絡の定義と上書きを字面で読み、enabled:false・email の除外・adminEditableOnly・throttle を止める(点 = lib/messaging の messages)
- `pureImports.mjs` 値 import の推移の検査と override のキーの読み取り / `switches.mjs`・`overrides.mjs` 1 行スイッチの形・上流の override / `orphans.mjs`・`overrideKeys.mjs` 孤立・宣言に無い鍵 / `generate.mjs`・`check.mjs` 入口

## Verification

- `pnpm test scripts/structure/extensions/`(生成器の回帰テスト(fixture)と実リポの一致。選ぶ点は `select.test.mjs`)
