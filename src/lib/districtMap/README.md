# src/lib/districtMap — 地区の地図

## Overview

アプリを「地区(district)」に分けて見つけ、各地区が何を持つかを 1 つの読み手で返す lib。今の宣言(domain.json・domainEntry・extensionPoints・門の規則・`frame:`・CATALOG.md)が正本のままで、この読み手はそれを字面で読むだけ(ファイルは実行しない)。

地区 = 一つの性質を持つまとまり(名前空間・増設点・持ち主の単位)。種類は 7 つに閉じていて(中間の Tier が種類を足す口は無い)、決まりは種類の表 1 か所(`kinds.mjs` の `KINDS`)の属性で持ちます。

| 種類 `kind` | hasGate(ゲートを持つ) | readsSet(地区の一覧を読む) | addedBy(足せる Tier) | forkMay(fork の変え方) | 上書き |
|---|---|---|---|---|---|
| `domains` | ○ | - | どの Tier も | replace・override・add・counterpart | 地区の名前 `src/config/domains/<名前>.config.ts` |
| `lib` | - | - | どの Tier も | replace・override・add・counterpart | 地区の名前 `src/config/lib/<名前>.config.ts` |
| `frame`(枠) | - | - | どの Tier も | replace・override・add・counterpart | 地区の名前 `src/config/layout/<名前>.config.ts` |
| `featureGate`(門番) | - | ○ | Tier1 だけ | add・counterpart | 中身の名前 `src/config/featureGate/<中身>.config.ts`(持ち主は `src/featureGate` に固定) |
| `registry`(登録表) | - | ○ | Tier1 だけ | なし(生成物と fork の区画) | なし |
| `wiring`(結線) | - | ○ | Tier1 だけ | add | なし |
| `proxies` | - | - | Tier1 だけ | add | なし(テーマの種類は畳んだ、D30。項目は各ドメインの plugs から差す) |

- ゲートを持つのはドメインだけ。ゲートの無い地区はドメインを読まず渡してもらいます(地区の議会 D22)。readsSet の種類は生成された一覧(地区の集合)を読みます
- forkMay は今の CHANGE_TYPES の名前。点の宣言は 2 段(D35): 地区だけの点は各地区の `extensionPoints.ts`(各点に `change`)、種類の地区が全部持つ点は `kindPointsOf`(config.ts ↔ src/config・config.ui.ts ↔ .ui.config.ts の対置点、枠の `layout` = _layout の隣の layout.tsx の 1 行スイッチの差替点)。1 行スイッチ(`.default`)の差替点は持ち主の地区の宣言に書き、`replacePointsOf` が読む(スイッチの検査・受け口の一覧・地図が使う)。受け口の一覧(intake.txt)の生成区画の行は `intakeRowsOf`(./intakeRows.mjs、宣言の点・差替点のスイッチ・ルートの画面と枠のスイッチ・生成器を入力に取る純関数)。ルートの page.tsx の 1 行スイッチは地区と 1 対 1 でないので種類の点にせず、読み手の入力のルートの一覧で満たす。地図の各地区の `forkCan` = 2 段を合わせた `{ point, change, where }`(where = fork が書くファイルの glob。writer の一覧は除く: fork は隣の addable の上書きの点で JSON を足す)
- forkCan の `where` = fork が書くファイルの glob(リポ相対)。plugs の点は `<自分のドメインか lib>/plugs/<点>/*`(項目は自分の地区のフォルダ `src/domains/<名前>` か `src/lib/<名前>` に置く。上流の地区の中には足さない)

見つけ方:

| 種類 `kind` | 見つけ方 | 名前 | config | 上書き |
|---|---|---|---|---|
| `domains`(ドメイン) | `src/domains/` と `src/domains/core/` の直下の `_` で始まらないフォルダ | フォルダ名(core は `core: true`) | `<dir>/config.ts` | `src/config/domains/<名前>.config.ts` |
| `lib` | `src/lib/` の直下のフォルダ(見つけ方は `src/lib/libPackage` の `listLibsFrom` と同じ 1 つの決まり) | フォルダ名 | `<dir>/config.ts` | `src/config/lib/<名前>.config.ts` |
| `frame`(枠) | `src/app/**/_layout/config.ts` の `frame: "<名前>"` の宣言(宣言の無い `_layout` は地区でない) | 宣言の名前 | `<_layout>/config.ts` | `src/config/layout/<名前>.config.ts` |
| `featureGate`・`registry`・`wiring`・`proxies` | `src/featureGate`・`src/registry`・`src/wiring`・`src/proxies`(src 直下の 1 地区、フォルダがあれば) | フォルダ名 | `<dir>/config.ts` | 上の表 |

- 描画専用の値を持つ地区だけ、`config.ts` の隣に `config.ui.ts`、上書きは `<名前>.ui.config.ts`(同じフォルダ)を並べます。上書きの置き方と 1 対 1 の検査: [src/config/README.md](../../config/README.md)・`pnpm check config-overrides`
- cron task・role・setting の項目・storage の用途などは地区ではなく、どこかの地区の受け口の項目です
- 門(`src/featureGate/rules/<名前>.ts`)は地区と別の単位です(複数のドメインを束ねる門・ドメインの無い門があります)。地区の `gates` は「features に自分を持つ規則」です
- 所有(どのリポの物か)はこの地図に載せません。所有の軸は `src/lib/forkOwnership`・`src/lib/folderCatalog`(CATALOG.md)です

- 使い手は道具・lint・生成・検査(実行時に地区の一覧が要るコードは無い)

## Usage

```js
import { readDistrictMap, toJsonl } from "@/lib/districtMap";          // 入口 ".": 読み方を注入する(node の API を使わない)
import { readDistrictMapAt } from "@/lib/districtMap/node.mjs";        // 入口 "./node": 今の木を node:fs で読む(道具・検査・テスト)

const { districts, problems } = readDistrictMap({ listDir, readText });
```

- 閉じた lib: 外からは 2 つの入口だけを読む(scripts からは相対で `src/lib/districtMap/index.mjs` / `node.mjs`)。`.` = ファイルを読まない物(地図の読み手・字面の読み手・`kinds`・宣言の読み方・名前の決まり)、`./node` = node:fs・node:path を使う物(`readDistrictMapAt`・`nodeDistrictSource`・宣言を木から探す `collectPoints`・`findDeclarationFiles`・`overrideKeysOf`・`domainOutputs.mjs` の全部)。同じ名前を 2 つの入口に置かない
- `listDir(rel)` = フォルダの直下の `{ name, isDir }[]`(無ければ `[]`)、`readText(rel)` = 本文(無ければ `null`)。パスはリポジトリ直下からの相対
- 使い手: 登録表の生成(ドメインの一覧・表・domain.json・storagePurposes.ts、`scripts/structure/registry`)・門の生成の featureTables(`scripts/structure/extensions/derive/featureTables.mjs`)・上書きと持ち主の 1 対 1 の検査(`scripts/structure/config-overrides`)

## API

### 地図の戻り値

- `districts`(各地区の欄 `District`)・`problems`(空でなければ地図は使えない。生成器は書かない)
- `tableFiles`(domains の地区の表と定義ファイル、パス順 → 出現順。schemaRegistry が使う、jsonl には載せない)と `tableProblems`(表名を字面で読めない問題だけ)

### 各地区の欄(`District`)

- `kind`・`name`・`core`(features だけ true / false、ほかは null)・`dir`
- `config` と `override`(`{ path, exists }`)・`uiConfig` と `uiOverride`(描画専用の `config.ui.ts` と `<名前>.ui.config.ts`、同じ形)
- `apiKeys`(domainEntry のキー)・`tables`(地区の中の `pgTable` の表名、テストを除く)・`requires`(domainEntry の requires)
- ゲートの無い地区(種類の表の `hasGate: false`)のファイルはドメインを値も型も読まない: lint `import-boundaries/district-no-domains` がこの種類の表と地図の枠で地区を決める(D22。テストと `__tests__/` の下の補助・生成物は対象外)
- `gates`(features に自分を持つ規則の名前)・`alwaysOpen`(domains だけ: 常設の明示の宣言 `export const alwaysOpen = true`。`gates` が空なら true、空でなければ false でないと止める)・`receptacles`(地区の中の extensionPoints.ts の点の名前)・`frame`(枠だけ)
- `featureRequirements`(持ち主の config.ts の機能を要する値の宣言。判定は門番の検査、`src/config/README.md`)

- domainEntry のキー(汎用 API・表の資源の名前)は地区の名前と別。1 ドメインが複数のキーを持ってよく、フォルダ名と違ってよい。キーは全部の地区を通して一意(重なりは problems)
- 名前は種類の中で一意(features の core と業務の同名・枠の `frame:` の名前の重なりは problems)

載せない物: 値・access・関数・門の pathPatterns と enabled・受け口の項目の一覧・所有(所有の軸は `src/lib/forkOwnership`・`src/lib/folderCatalog`(CATALOG.md))。

### ほかの読み手と決まりの元

- 字面の読み手 `readTableNames`・`readDomainEntry`・`readRuleDomains`・`readFrameName`・`readOverrideImports`(持ち主の上書きに許す読み込みの宣言 `overrideImports`、lint `config-overrides/literal-only` が読む。地図には載せない)・`readFeatureRequirements`(機能を要する値の宣言、地図の欄)
- `kinds.mjs`: 種類の表 `KINDS`(7 種類と属性)と、そこから導く `DISTRICT_KINDS`・`OVERRIDE_FOLDERS`(地区の名前で置く上書き)・`CONTENTS_OVERRIDE_FOLDERS`(中身の名前で置く上書き)・見つけ方の定数
- `declarations.mjs`(入口 `.`、ファイルを読まない)と `declarationFiles.mjs`(入口 `./node`、木から探す `collectPoints`・`findDeclarationFiles`・`overrideKeysOf`): 受け口の宣言(`extensionPoints.ts`)の読み手(`pointsFromFiles`(ファイルの一覧と読み方を渡す形。git の版の木を読む `pnpm workflow ownership who` が使う)・`readDeclaration`・`literalOf`)。生成器・所有の検査の単位名・配線のテストが読む
  - 選ぶ点(`select` を持つ plugs の点、`isSelectPoint`)の形と持ち主(lib か常設のドメイン)、ドメインの要る能力 `export const backendRequirements`(`pointsFromFiles` の戻り値 `backendRequirements`)、選ぶ点の項目の宣言 `export const declaration` の読み手 `readBackendDeclaration`(D29 の形だけ。選択表との照らし合わせは `scripts/structure/extensions/select.mjs`)
- `extensionNames.mjs`: 拡張の名前の決まり(1 行スイッチ `<名前>.default` ↔ 素の名前 ↔ `<名前>.replace`・ほかの仕組みが名乗る `.default`・`<対象>.override.ts` ↔ 対象・枠の宣言の `frame.ts` / `frame.override.ts`)。`scripts/structure/extensions` の検査と `pnpm workflow ownership who` が読む(who は scripts を読めない)
- `domainNames.mjs`(単数 → 複数・管理画面のルートのフォルダ。`pnpm generate domain` が再 export して使う)と、`pnpm generate domain` の出力の種類のデータ(`scripts/structure/domain/phase.json` の `outputs`)をパスに当てる `domainOutputs.mjs`
- `read.mjs`: 地区を見つけるだけの `discoverDistricts`(欄を読まない)と config の置き場 `configSlotsOf`(who が型 4(placement、src/config の値)の置き場を引く)
- `dottedNames.mjs`: 受け口のファイル名の点つきの形の分類。印なし `<名前>` / 既定 `<名前>.default` / 丸ごと置き換え `<名前>.replace` / 一部の上書き `<対象>.override`(`<対象>` は `user.role` のように `.` を含んでよい)/ client の口 `<名前>.client` / テスト `.test`・`.spec`・`.d` / それ以外 = 旧い fork の名前の印。生成器・タスク・常時実行の例外・`src/wiring` の目録・screens の検査・所有の検査が使い、旧い印は止めて、旧い印から今の名前の形へ移す notice を案内する(`oldMarkerProblem`)

## Extension

- この lib の `extensionPoints.ts` は `configValues`(`src/config/**` = 全地区の上書きの置き場、kind edit)を宣言する

## Internals

### 集約ファイル `src/registry/district-map.jsonl`

- `pnpm generate district-map` が作り(1 行 1 地区、並びは種類 → 名前)、`pnpm check district-map` が今の木と同じかを見る(検査の段 build・ship・forge:post = pnpm check --phase=<名前>)
- 読み手は人と agent・/sluice と /flux の差分の見張り。src からの import は lint `import-boundaries/src-no-district-map` が止める(テストも)
- 生成器と検査器: `scripts/structure/district-map/`
- lib は src 直下(門番・registry・wiring)を import しないので、この読み手は門の規則も字面で読む

## Verification

- `pnpm test src/lib/districtMap` — 注入した小さな木で 7 種類・欄・名前の重なり・問題の文
- `direction.test.mjs` — forkOwnership を import しないこと(札 one_way)
- `pnpm test scripts/structure/district-map` — 今の木の正本(登録表の走査・表の走査・門の規則・受け口の宣言)との照合と、生成器・検査器の振る舞い

## Related

- 上書きの置き方と 1 対 1 の検査: [src/config/README.md](../../config/README.md)
