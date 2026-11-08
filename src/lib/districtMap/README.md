# src/lib/districtMap — 地区の地図

アプリを「地区(district)」に分けて見つけ、各地区が何を持つかを 1 つの読み手で返す lib です。宣言のファイルは新しく置きません。今の宣言(domain.json・domainEntry・extensionPoints・門の規則・`frame:`・CATALOG.md)が正本のままで、この読み手はそれを字面で読むだけです(ファイルは実行しません)。

## 地区とは

地区 = 自分の名前空間・`config.ts`(既定値と型)と `src/config` の上書き 1 本・受け口を持ち、所有の単位になる区画。種類は 4 つに閉じています(中間の Tier が種類を足す口はありません。足りなければ `/order` で Tier1 に頼みます)。

| 種類 `kind` | 見つけ方 | 名前 | config | 上書き |
|---|---|---|---|---|
| `features`(ドメイン) | `src/features/` と `src/features/core/` の直下の `_` で始まらないフォルダ | フォルダ名(core は `core: true`) | `<dir>/config.ts` | `src/config/features/<名前>.config.ts` |
| `lib` | `src/lib/` の直下のフォルダ | フォルダ名 | `<dir>/config.ts` | `src/config/lib/<名前>.config.ts` |
| `frame`(枠) | `src/app/**/_layout/config.ts` の `frame: "<名前>"` の宣言(宣言の無い `_layout` は地区でない) | 宣言の名前 | `<_layout>/config.ts` | `src/config/layout/<名前>.config.ts` |
| `proxies` | `src/proxies/`(全体で 1 つ) | `proxies` | `src/proxies/config.ts` | `src/config/proxies/proxies.config.ts` |

- cron task・role・setting の項目・storage の用途などは地区ではなく、どこかの地区の受け口の項目です
- 門(`src/featureGate/rules/<名前>.ts`)は地区と別の単位です(複数のドメインを束ねる門・ドメインの無い門があります)。地区の `gates` は「features に自分を持つ規則」です
- 所有(どのリポの物か)はこの地図に載せません。所有の軸は `src/lib/forkOwnership`・`src/lib/folderCatalog`(CATALOG.md)です

## 名前の決まり

- 名前は種類の中で一意。features では core と業務の同名を失敗にします(core は Tier1 の物なので、直すのは業務の側 = 後から足した fork か中間の Tier)。枠は `frame:` の名前の重なりを失敗にします
- domainEntry のキー(汎用 API・表の資源の名前)は地区の名前と別です。1 ドメインが複数のキーを持ってよく、フォルダ名と違ってよい。キーは全部の地区を通して一意を失敗の条件にします

## 入口

```js
import { readDistrictMap, toJsonl } from "@/lib/districtMap";          // 読み方を注入する(node:fs を使わない)
import { readDistrictMapAt } from "@/lib/districtMap/node.mjs";        // 今の木を node:fs で読む(道具・検査・テスト)

const { districts, problems } = readDistrictMap({ listDir, readText });
```

- `listDir(rel)` = フォルダの直下の `{ name, isDir }[]`(無ければ `[]`)、`readText(rel)` = 本文(無ければ `null`)。パスはリポジトリ直下からの相対
- `problems` が空でなければ、地図は使わずに直します(生成器は書きません)
- 戻り値には `tableFiles`(features の地区の表と定義ファイル、パス順 → 出現順。schemaRegistry が使う、jsonl には載せない)と `tableProblems`(表名を字面で読めない問題だけ)もあります
- 使い手: 登録表の生成(ドメインの一覧・表・domain.json・storagePurposes.ts、`scripts/structure/registry`)・門の生成の featureTables(`scripts/structure/extensions/derive/featureTables.mjs`)
- 字面の読み手 `readTableNames`・`readDomainEntry`・`readRuleFeatures`・`readFrameName` も出しています
- 4 種と見つけ方の定数は `kinds.mjs`
- 受け口の宣言(`extensionPoints.ts`)の唯一の読み手 `declarations.mjs` もここにある(`collectPoints`・`readDeclaration`・`literalOf`。生成器・所有の検査の単位名・配線のテストが読む)。古い置き場 `src/lib/forkOwnership/declarations.mjs` は再 export だけで、予告の後に消す

アプリのコードは地図を読みません(実行時に地区の一覧が要るコードはありません)。使い手は道具・lint・生成・検査です。lib は src 直下(門番・registry・wiring)を import しないので、この読み手は門の規則も字面で読みます。

## 各地区の欄(`District`)

`kind`・`name`・`core`(features だけ true / false、ほかは null)・`dir`・`config` と `override`(`{ path, exists }`)・`apiKeys`(domainEntry のキー)・`tables`(地区の中の `pgTable` の表名、テストを除く)・`requires`(domainEntry の requires)・`gates`(features に自分を持つ規則の名前)・`receptacles`(地区の中の extensionPoints.ts の点の名前)・`frame`(枠だけ)。

載せない物: 値・access・関数・門の pathPatterns と enabled・受け口の項目の一覧・所有。

## 集約ファイル `src/registry/district-map.jsonl`

- `pnpm generate district-map` が作り(1 行 1 地区、並びは種類 → 名前)、`pnpm check district-map` が今の木と同じかを見ます(門 build・ship・forge:post)。手で直さず、ずれたら作り直します
- 読み手は人と agent・/ship と /flux の差分の見張りです。src から import しません(lint `import-boundaries/src-no-district-map`、テストも)。他の生成の入力にもしません(道具は毎回この lib を呼ぶ)
- 生成器と検査器: `scripts/structure/district-map/`

## テスト

- `pnpm test src/lib/districtMap` — 注入した小さな木で 4 種・欄・名前の重なり・問題の文
- `pnpm test scripts/structure/district-map` — 今の木の正本(登録表の走査・表の走査・門の規則・受け口の宣言)との照合と、生成器・検査器の振る舞い
