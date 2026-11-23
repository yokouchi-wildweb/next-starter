# src/featureGate — Internals

## Overview

featureGate の README の Internals を分けた文書(README が 20,000 字を超えるため)。ドメインの開閉・スキーマ・常時実行の入口・依存の検査・段階 build の検査・全開スイッチ・守り。

## Internals

### ドメインの開閉(表・汎用 API・cron)と設定の節

- ドメイン = どれかの規則の `domains` に載るフォルダ(生成一覧の `domains`: フォルダ・表・汎用 API の住所・持つ機能)。**開 = そのドメインを `domains` に持つ機能のどれかが開**(1 つのドメインを複数の機能に書いてよい)。どの機能にも載らないドメインは常設として常に開(明示の宣言 `alwaysOpen`、地図の行。機能の組み合わせの検査 `checks/integrity.mjs` もこの宣言を読む)
- ドメインの開閉で決まる物: 表(`pnpm db:push` / `db:push:check`・`pnpm ops db seed`・`pnpm ops db clear`)・汎用 API の住所(`apiPaths`)・cron の task(`cronTasks`、読むドメインが全部開のとき開)
- 評価は `ruleList.ts`(`closedDomainsOf`・`domainEnabled`・`closedDerivedEntries`・`closedDomainTables`)。機能の開閉は渡した一覧で読む: `rules` なら全開スイッチを通し、`configRules` なら規則の値だけ
- 設定の節(`settingSections`)は節自身の判定: 名指す機能が全部開のときだけ開く(導出の住所の 1 種、`closedDerivedEntries`)
- 住所で覆うかを見る検査(依存の検査・常時実行の入口・ルートの被覆)は、その機能だけを閉じたときの閉じた住所(手書き・導出・依存元の住所、評価そのもの `coveredPatternsOf`)に `pathPatterns` を置き換えた写し(`withCoveredPatterns`)で見る。1 つのドメインを複数の機能が持てば、機能 1 つを閉じてもそのドメインの住所は数えない

### スキーマゲートは作る方向にしか働かない

| 状態 | `pnpm db:push` の結果 |
|---|---|
| 最初から false | テーブルは作られない |
| false → true（初めて） | 次の push で作られる |
| true → false | **テーブルもデータも残る**（DROP しない）。false の間はスキーマ変更も当たらず、true に戻した push でまとめて反映される |

仕組み: 無効なテーブルを push の**両側**から外す。コード側（pushSchema に渡すスキーマ）から外すので作られず、DB 側（tablesFilter）からも外すので既存でも DROP されない。片側だけだと「コード側だけ = DROP TABLE CASCADE」「DB 側だけ = 既存テーブルへの CREATE」になる（実測済み）。

- enum は外さない（コード側から消すと DROP TYPE が出る。空の型が残るだけで無害）
- serial / identity 列（sequence）を持つテーブルは想定していない。ゲート対象のテーブルに足す場合は sequence の扱いを検証すること
- `drizzle-kit push` を直接叩くとゲートを通らない（全テーブルが作られる。消えはしない）。push は必ず `pnpm db:push` で行う
- 外す表を残す表が外部キーで参照していると例外（導いた表に掛かる）

### pnpm ops db clear と閉じた機能の表

`pnpm ops db clear`（`scripts/operations/db/clear/`、計画は純関数 `plan.ts`、検査 `pnpm test scripts/operations/db/clear/plan.test.ts`）は閉じた機能の表（`@/featureGate/node` の `closedTables`）に触れない。

- 選べる表（対話の選択肢と `--all`）から閉じた表を外し、外した表は名前を出す
- 選んだ表を参照する表を schemaRegistry の外部キーから推移的に足し、確認の前に「選んだ表 / 足した参照元 / 外した表（DB に無い・閉じた）」を見せる
- DB にある閉じた表が消す表を参照していると、何も消さずに全部並べて exit 1（DB に無い閉じた表には制約も無いので止めない）
- 消すのは 1 文の `TRUNCATE TABLE "a", "b", … RESTRICT`（全部消えるか何も消えないか。連鎖の削除は使わない）
- 閉じた表も選び・参照元に足すのは `--include-closed` のときだけ

### seed と閉じた機能

`pnpm ops db seed` は各ドメインの `seed.ts` を走査し、そのドメインのフォルダを `domains` に持つ規則が閉じていれば飛ばして名前を出す(宣言は要らない)。閉じたドメインを `after` に持つ開いたシードは理由を出して止める。詳細: `scripts/runner/seed/README.md`「閉じた機能とシード」

### 常時実行の入口

ゲートが閉じるのはその機能自身のルートとテーブルだけ。常に動く処理（cron・退会の後片付け・集計の照合・常に読み込まれる結線）が無効な機能を使うと、テーブルが無くて失敗する。`pnpm test src/featureGate scripts/structure/proxies` が全規則を無効とみなして次を見る（判定: `checks/alwaysOnEntries.mjs`）:

| 入口 | 閉じ方 |
|---|---|
| cron の `src/app/api/cron/<name>/task.ts` | タスクの住所 `/api/cron/<name>` を、import する機能のフォルダを `domains` に持つ規則の全部が `pathPatterns` で覆う。住所は生成器が task.ts・task.override.ts の import から導いて規則の `cronPaths` に足す（規則に手書きしない。閉じた機能のタスクは route = `@/wiring/cronRoute`・`pnpm task`・`pnpm generate cron` が住所で飛ばす。task.ts に機能の入切は書かない。`src/lib/cron/README.md`「1. task.ts」） |
| 宣言に `alwaysOn: true` の拡張点の項目（`cleanupHandlers`・`coinIssuanceSources`・`rollupMetrics`） | 項目に `enabled` |
| 生成された plugs の点の一覧（`src/wiring/<lib>.ts`・`<持ち主>/extensions/<点>.ts`） | 使う時に `gate.plugs` が閉じたドメインの項目を外す |
| 常に読み込まれる結線（`src/app/layout.tsx`・`src/wiring/**`・`src/proxies/**`・`src/featureGate/**`） | import しない(例外表は無い。ドメインの値・処理は地区が宣言した点の項目として受け取る、D22・注文 36。ゲートの無い地区はドメインを値も型も読まない lint `import-boundaries/district-no-domains` も同じことを見る、テストと `__tests__/` の補助は対象外) |

- 規則のファイル（`rules/<名前>.ts`）が機能のドメインの入切の値 `@/domains/<d>/config`（`config.ts`、値だけ）を読むのは閉じ漏れに数えない（入切でない条件の値、例 決済の自社振込が選べるか。入切そのものは規則の `defaultEnabled` と `switches.config.ts`）。`config.ts` が値の外（services・drizzle・server-only）に届くと到達の検査 `pnpm test src/featureGate/checks/reachability.test.mjs` が止める

- 例外表と fork の受け口(`ALWAYS_ON_EXCEPTIONS`・`alwaysOnExceptions/`・`alwaysOnRegistries`)は消した(注文 36)。残った fork の項目は `pnpm generate extensions` が止め、代わりのやり方(点の項目・自分のドメインの plugs)を出す
- 限界: 直接の import だけを見る（別のモジュールを経由した到達は見ない）。`enabled` の式が本当にその機能のフラグかは見ない
- 上の外にも呼び出し側でフラグを見る経路がある（登録時の招待コード消し込み `auth/services/server/registration.ts`、管理画面ユーザー一覧の残高調整 `user/components/admin/*UserList/Table.tsx`）。サービスの層で止める仕組みは別の議題

### 依存の検査

閉じられるフォルダ(規則の `domains`)を、そのフォルダの外から値で import するファイルは、次のどれかでなければ `pnpm test src/featureGate scripts/structure/proxies` が落ちる(判定: `checks/dependencies.mjs`):

1. 自分のドメインの `services/server/domainEntry.ts` の `requires` に相手のドメインの名前がある(`requires: ["wallet"]`、文字列リテラルの配列で書く。字面で読む)。名前はドメインのフォルダ名だけ(`core/` は付けない)。`domainEntries` のキーは汎用 API・表の資源の名前でドメインの名乗りにならない(フォルダ名と違うキー、例 `auditLogFailed` を書いても当たらない)。ドメイン・requires の読み手は `src/lib/districtMap`
2. ファイルが規則の名前で確かめる: `gate.enabled("wallet")`・`gate.assert("wallet")`・`useGate().enabled("wallet")`。`dependsOn` で(推移的に)その規則にたどり着く規則の名前でもよい(例 `core/analytics` を `useGate().enabled("messagingAnalytics")` で守る。子は親が開の時しか開かない。`anyOf` は親を決めないので数えない)
3. ファイルが src/app の下で、その規則の `pathPatterns` が覆う住所にある(page・loader・route・`_screen`・`_components` など。閉じれば一緒に閉じる)
4. 同じ規則のフォルダどうし
5. fork の `required/<規則名>.ts` がある(この fork はその機能を必ず使う = 依存を書いたとみなす)
- 例外の受け口(前の `dependencyExceptions/`)は無い(注文 36): 字面で守れない読み(動的 import の結線など)は読みをやめ、点の項目として受け取る。残った項目は `pnpm generate extensions` が止める

- 数えない: 生成の一覧(`src/registry`)・`src/featureGate`・`pnpm generate extensions` の生成物(plugs の点の一覧は使う時に `gate.plugs` が閉じたドメインの項目を外す、D26。例: API の Factory の端末の束は生成物 `src/wiring/routeFactory.ts` の一覧から `src/wiring/apiRoute.ts` が門番で絞る)・テスト・型だけの import。動的 import と副作用 import は数える
- 上流の違反は 0(全 Tier で同じ検査。上流の縮む表は 0 行になって表ごと消した)
- 強さ: 全 Tier で落とす(区切り gate-s3 から。gate-s2 の間は Tier1 でない repo では表示だけだった)。fork の移行は codemod `.notices/20261105-112509-feature-gate-automation.feature-gate-s3.mjs`(今開いている機能の違反を `required/<規則>.ts` に書き出す。閉じた機能の違反は一覧に出すので手で直す。`.notices/README.md` の codemod の節)
- 限界: 字面だけを見る。別のモジュールを経由した到達、2 の呼び出しが import の使い所を本当に守っているか、機能どうしの前提(payment が閉じれば wallet の画面も閉じる等)はたどらない

### 段階 build の検査(pnpm check proxies: 機能を要する設定の値・明示的に開けた子)

設定の値が機能を前提にするのに、その機能が規則の値で閉の組み合わせ(例 wallet の `purchaseRestriction: "phoneVerified"` で `phoneVerification` が閉)は、段階 build の `pnpm check proxies`(`scripts/structure/proxies/check.ts`、門番の検査をビルドで止める入口）が失敗にする。

- 判定は `checks/featureRequirements.ts`(地区の地図の宣言 → 持ち主の defineConfig の定義に上書きを合成した値 → `configEnabled`、全開スイッチは通さない)
- 宣言の書き方: `src/config/README.md`「持ち主の宣言 featureRequirements」
- テスト `FEATURE_GATE_CHECK=all pnpm test src/featureGate/checks/featureRequirements.test.ts`

同じ入口で、fork が `src/config/featureGate/switches.config.ts` で明示的に `true` にした機能の `dependsOn` の先(推移的)が規則の値で閉なら失敗にする(`checks/explicitChildren.ts`。開けたつもりの子が親のせいで黙って閉のまま、を止める)。直し方は親を開けるか子の行を消す。上流の既定 `defaultEnabled: true` の子(switches に書いていない物)・`anyOf` は対象にしない。テスト `FEATURE_GATE_CHECK=all pnpm test src/featureGate/checks/explicitChildren.test.ts`

### 門番の範囲外

門番が閉じるのは、規則の住所(ページ・API)・表・常時実行の入口・リンクとメニュー・依存の検査が見る import まで。次は門番では止まらないので、その機能の側で閉じる:

- 他のドメインの画面の中の細かい出し分け(欄・ボタン・文言の一部): その画面が `useGate.enabled` / `gate.enabled` で確かめる
- API を通らない書き込み・読み出し: client から直に Firestore に書く処理、外部サービスの webhook を自前で受ける処理など(住所で閉じないので、規則の住所の外で動く)
- 規則の `enabled` の式が本当にその機能の入切かは見ない

### 全開スイッチ(FEATURE_GATE_OPEN)

閉じた機能を env 1 つで開ける(上流の開発・デモで全機能を見る、fork の開発で sample を見る)。規則の値(config)は書き換えない。

```bash
FEATURE_GATE_OPEN=all              # 全規則を開く
FEATURE_GATE_OPEN=coupon,wallet    # 名前の規則だけ開く(区切りは , と空白。名前 = rules/<名前>.ts)
```

- 未設定・空 = 規則の値のまま。未知の名前は判定のたびに throw(打ち間違いを黙って閉じたままにしない。proxy では全リクエストが失敗するので、置いたらすぐ気付く)
- 効く条件: 段階(`@/lib/appEnv` の `getAppEnv`、決まりは [src/lib/appEnv/README.md](../lib/appEnv/README.md))が `development` なら全 Tier。staging・production(値なし・知らない値も)は **Tier1 だけ**。効かない所(fork の本番など)では値を読まない(置かれていても落とさない)
- Tier1 の判別(`openSwitch.ts` の `isTier1Build` 1 つ): Next のビルドは `next.config.ts` が fork_id(`readForkIdentity.isTier1`)から計算して埋め込む `FEATURE_GATE_TIER1`(fork の build では `"false"`。埋め込みが勝つので Vercel の env では上書きできない)。注入の無い node(scripts・テスト)は `node.ts` が読むだけで渡す読み手 `node/tier1.ts`。`openSwitch.ts` は proxy の束に載るので `node:` を読まない
- **名前指定は依存先を開けない**: `FEATURE_GATE_OPEN=<子>` で親が閉なら子は閉のまま。足りない名前(名前で開けた機能の推移的な依存先のうち、スイッチにも無く規則の値も閉の物)を値ごとに 1 回 `console.warn` し、`pnpm ops features list` に出す(`switchMissing`)。開けるなら依存先も名前に足す(`all` は全部開くので関わらない)
- 判定の入口は `ruleList.ts` の 1 つ: 生成一覧の各規則の `enabled` を「(スイッチで開いている || 規則の `enabled`) && 依存先が全部開」に差し替えた `rules`。門番の口・`clientGateState` はこれを読み、client は server の答えを受け取るだけ(client で env を読み直さない)

上流(Tier1)の開発の約束: 上流は付け足しの機能を閉じて出荷するので、上流の開発の env(`.env.development`、git に入らない)は `FEATURE_GATE_OPEN=all` を置く。

- 置かずに `pnpm db:push` すると、閉じた機能のドメインの表は push の両側から外れる(スキーマゲート、上の「仕組み」): 無い表は作られず、ある表はデータごと残り(DROP は出ない)、閉じている間はスキーマの変更も当たらない。上流の開発ではその表の変更を確かめられないので置く
- `route-map.jsonl` の閉(`gatedOff`)と cron(`vercel.json`)は規則の値(本番の値)で書く。スイッチで開けても揺れない
- fork の既定は空(規則の値のまま)。fork は使う機能を `src/config/featureGate/switches.config.ts` で開け、スイッチは開発で sample を見るときだけ使う

道具ごとの効く範囲(L2.3):

| 道具 | スイッチ | 読む物 | 理由 |
|---|---|---|---|
| 門番の口(`gate.*`)・proxy・`useGate` | 効く | `rules` | 開けた機能の画面・API を見る |
| `pnpm db:push` / `db:push:check` の表 | 効く | `rules` | 開けた機能の表を作る(開発の DB だけ。`ENV_FILE` の env ファイルの `APP_ENV` で決まる: `.env.development` なら全 Tier、`APP_ENV=production` か値なしのファイルなら Tier1 だけ) |
| `pnpm ops db seed`・`pnpm ops db clear` | 効く | node の `gate.enabled`・`closedTables(rules)` | 表と同じ答え |
| 受入のテスト `pnpm e2e` の skip(`tests/e2e/featureGate.ts`) | 効く | `rules` | サーバーと同じ答え。runner は `playwright.config.core.ts`(素の `playwright.config.ts` が読む)で開発の env(`ENV_FILE`、既定 `.env.development`)を読む |
| `pnpm ops features list` | 見せ方 | `rules` + `configEnabled` + `ownEnabled` + `isOpenedBySwitch` + `switchMissingDependencies` | 規則の値で閉・スイッチで開を「閉 → 開(スイッチ)」と出す。名前指定で開けたが依存先が閉なら足りない名前を出す。`--json` は `enabled`・`configEnabled`・`ownEnabled`・`openedBySwitch`・`switchMissing` |
| `pnpm generate cron` / `pnpm check cron`・`pnpm task` | 効かない | `configPath` | `vercel.json` と照合が env で揺れない。スイッチで開けた機能の cron は `vercel.json` に載らない(route は開くので手で叩けば動く) |
| `pnpm generate routes` | 効かない | `configRules` | コミットする `route-map.jsonl` が env で揺れない |
| `FEATURE_GATE_CHECK` の検査・依存の検査・codemod `feature-gate-s3` | 効かない | `configRules` | 検査の答えが env で揺れない |
| `pnpm ops features set`・`required/` | 関わらない | config の字面 | 規則の値を書く道具 |

検査: `scripts/structure/proxies/openSwitch.test.ts`(値・効く条件・Tier1 の判別・依存の連鎖と名前指定の足りない名前・範囲の表・入口の字面の検査・`next.config.ts` の注入)。依存の評価・説明・set の計画の単体は `src/featureGate/checks/dependsOn.test.ts`、生成器の検査は `scripts/structure/extensions/extensions.test.mjs`。

### 守り

- lint `import-boundaries/feature-gate-entries`: 外からは入口 3 つだけ・lib は読まない・`node.ts` は scripts とテストだけ・配線用の `clientGateState`・`GateProvider` は配線の 4 ファイルだけ(`eslint-rules/import-boundaries.mjs`)
- 到達の検査 `pnpm test src/featureGate/checks/reachability.test.mjs`: `index.ts`・`client.ts` から値の import をたどり、domains の services・`src/lib/drizzle`・DB のパッケージ・`server-only`・`node:` に届いたら鎖を示して落とす(門番は proxy と client の束に載る。規則は config だけを読む)。`client.ts` からは規則・規則の一覧・評価(`evaluate.ts`・`clientState.ts`)・config にも届かない(client は規則を評価しない)
  - proxies の鎖(`src/proxy.ts`・`src/proxies/index.ts`)からは、たどり着いた config(`src/config/**`・地区の `config.ts`・`*.config.ts`)の先だけを同じ禁止の先で見る(proxies の項目は任意のドメインの config を読んでよいが、config は値だけ。鎖そのものの services は判定しない)
- lint `page-authz/session-api-callsite` は `src/featureGate/**` にも掛かる(規則と判定はセッションを解かない)
- 所有の検査(`pnpm workflow ownership check`): fork が受け口の外(`rules/`・`required/` の外)へ足したファイルは `gate-add` で違反(`src/lib/forkOwnership/README.md`)
