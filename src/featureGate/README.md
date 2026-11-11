# src/featureGate — 門番(機能を閉じる仕組み)

機能(人が開け閉めする単位、規則 1 本)を閉じると、その住所と、どの開いた機能にも使われなくなったドメインの表・汎用 API・cron を閉じる仕組み。fork が upstream の機能を「削除せず使わないまま残す」ための土台。

src 直下の専用の基盤に置く(lib にも core のドメインにも置かない)。src 直下の基盤に置いてよいのは、ドメインの集合を横断する仕組みだけ(今は featureGate・registry・wiring)。maintenance・demoMode・cron のタスクなど、仕組みに従う側は置かない。

## 言葉(D33)

- **ドメイン**(domain): 業務か仕組みの概念の部品。表・サービス・画面の部品の持ち主(今は `src/features/<d>/`)。**開閉の概念を持たない**: 開いた機能のどれかが規則の `domains` に持てば開、どの機能にも載らないドメインは基盤として常に開
- **機能**(feature): 人が開け閉めする単位 = 規則 1 本(`rules/<名前>.ts`、名前 = `FeatureName`)。使うドメイン(`domains`)・自分の住所(`pathPatterns`)・依存する機能(`dependsOn` / `anyOf`)・自分のスイッチ(`defaultEnabled` と fork の `switches.config.ts`)を持つ
- **門番**(featureGate): 機能の開閉を評価し、住所・表・汎用 API・cron・設定の節・リンクに及ぼす基盤(このフォルダ)。名前(`featureGate`・`FeatureName`・`gate` / `useGate`・設定の節の `feature:`・`pnpm ops features list / set`・`rules/`)はもとから機能の意味

## 置き場

| 置き場 | 持ち主 | 中身 |
|---|---|---|
| `rules/<名前>.ts` | 上流・fork(受け口) | 機能を閉じる規則(1 機能 1 ファイル、`export const rule`)。名前 = ファイル名 = `FeatureName` |
| `alwaysOnExceptions/<名前>.ts` | fork(受け口、上流の項目は 0) | 常時実行の入口の例外(`export const exception` か `export const registry`) |
| `dependencyExceptions/<名前>.ts` | fork(受け口、上流の項目は 0) | 依存の検査の例外(`export const exception: DependencyException`) |
| `required/<機能名>.ts` | fork(受け口) | この fork が必ず使う機能(`export const required: RequiredFeature`)。依存の検査はこの機能のフォルダを外から読むことを通す。pnpm ops features set / list での働きは次の区切り |
| `extensionPoints.ts` | 上流 | 受け口の宣言(`rules`・`alwaysOnExceptions`・`alwaysOnRegistries`・`dependencyExceptions`・`required`) |
| `extensions/` | 生成物 | `pnpm generate extensions` が書く一覧(手で編集しない)。`rules.ts` は名前の union `FeatureName` も出す |
| `index.ts` | 上流 | 入口(server・proxy): `gate`・配線用の `clientGateState` と型 |
| `client.ts` | 上流 | 入口(client): `useGate`・`GatedLink`・配線用の `GateProvider` と型 |
| `node.ts` | 上流 | 入口(道具: scripts とテストだけ): `rules`(全開スイッチを通した一覧)・`configRules` / `configEnabled` / `configPath`(規則の値だけ)・`isOpenedBySwitch`・`gatedSchema`・`closedTables`・例外の一覧 |
| `ruleList.ts`・`openSwitch.ts` | 上流 | 判定の入口(生成一覧を全開スイッチと依存先(dependsOn)で包む。門番の中で生成一覧を値で読み、規則の `enabled()` を直に呼ぶのはここだけ)と全開スイッチ(「全開スイッチ」の節) |
| `types.ts`・`evaluate.ts`・`hiddenHref.ts`・`area.ts`・`clientState.ts`・`tools/server/`・`tools/client/`・`node/` | 上流 | 型・判定の中身(外に出さない。`hiddenHref.ts` = 隠す判定・`area.ts` = 枠の判定の純関数で server と client が共有、`clientState.ts` = client に渡す値の計算)・1 道具 1 ファイルと束・道具の中身 |
| `checks/` | 上流 | 検査(`pnpm test src/featureGate scripts/structure/proxies`・`:reach`・`:tools`・`:client`) |

## 入口と gate の口

外からは入口 3 つだけを読む(lint `import-boundaries/feature-gate-entries`、全 Tier error)。lib は門番を読まない(値も型も。規則や判定は引数で受ける)。`node.ts` は scripts とテストだけ。テストは中の部品を読んでよい。

```ts
import { gate, type FeatureName } from "@/featureGate";

gate.enabled("wallet");        // 規則 rules/wallet.ts の enabled() の答え。未知の名前は型で落ち、実行時は throw
gate.assert("wallet");         // 閉じていれば DomainError(404、決まった文言)を投げる。開いていれば何もしない
gate.path("/wallet/history");  // { open: true } | { open: false; rule: FeatureName; redirectTo?: string }
gate.filter(menuItems);        // 閉じた機能の住所を指す項目を除く(既定は item.href、順は保つ)
gate.filter(rows, (row) => row.link); // href を持たない型は住所の取り出し方を渡す(型で必須)
```

- `gate.assert`: service・API が自分で止まるときに使う。文言は「お探しのページは見つかりませんでした」で固定、機能の名前・`code`・`details` は出さない(閉じた機能の存在を利用者に知らせない)。未知の名前は `gate.enabled` と同じく throw
- `gate.path`: 閉じた住所(閉じた規則の手書きの住所 + 閉じたドメインの汎用 API・cron の住所)に当たれば、当たった中で**一番細かい一致**(長い住所、同じ長さは `=` の完全一致。`@/lib/pathPattern` の `patternSpecificity`)の `{ open: false, rule, redirectTo }`(同じ細かさは一覧の順)。導出の住所の `rule`・`redirectTo` は閉じた持ち主の機能のうち一覧の順で最初(D34)。読み手は proxy の項目 `src/proxies/featureGate.ts`(応答を作る)と demo の loader(閉じたデモを一覧から外す)
- `gate.filter`: メニュー・一覧から閉じた住所の行を隠すだけ(応答は proxy が作る)。除くのは「`/` で始まる内部の住所(`//` は別オリジンで対象外)で、閉じた住所の並びの順で最初に当たった規則に `redirectTo` が無い」項目だけ。`?` と `#` の後ろは照合から外す。外部 URL・`redirectTo` 付きの閉(行き先の画面がある。例: サインアップ → `/signup-closed`)・住所の無い項目(`getHref` が `undefined`)は残す。判定は `hiddenHref.ts` の純関数で、リンクの自動で隠す判定(client)も同じ関数を使う
- 管理のコマンドパレットの移動の候補は、管理の枠の中の橋 `AdminCommandGateBridge` が渡す厳密な `useGate().path` の判定で絞る(`redirectTo` 付きの閉も隠す。枠の外では絞らない。`src/features/core/adminCommand/README.md`)
- 管理メニューは `gate.filter` でなく `useGate().path` で隠す(厳密: `redirectTo` 付きの閉も隠す。行き先の画面があっても、閉じた機能の入口をメニューに出さない)。組み立ては `src/features/core/admin/hooks/useAdminMenu.ts`、仕組みは `src/features/core/admin/menu/README.md`。メニュー専用のスイッチや項目の `feature:` は持たない
- 既存の読み手(demo の loader・service の自己停止)は `gate.assert` / `gate.filter` へ移す途中(まだ直読み・`gate.path` の箇所がある)
- 中の名前(`isFeatureEnabled`・`resolvePath`)は外に出さない。道具を足すときは `tools/server/<名前>.ts` に 1 ファイル、束 `tools/server/index.ts` に 1 行(client でも使う道具は `tools/client/` にも同じ名前で。束の名前の一致は `checks/gateTools.test.ts`: client の名前 ⊆ server、server だけの名前は `assert` だけ)

## client の口(useGate)

client は規則を評価しない。server が計算した値(`clientGateState(area)` = `{ 規則名: 開閉 }` と枠で絞った閉じた住所の並び)を `GateProvider` で受け取り、`useGate()` が読む。

```tsx
"use client";
import { useGate } from "@/featureGate/client";

const gate = useGate();
gate.enabled("referral");        // server の gate.enabled と同じ答え。未知の名前は throw
gate.path("/mypage/invite");     // { open: true } | { open: false; rule; redirectTo? }(範囲の中は server と同じ)
gate.filter(menuItems);          // server の gate.filter と同じ判定(hiddenHref.ts)
```

- 枠(範囲): 利用者の枠(`user`)= `/admin` と `/api` の下を除く住所。管理の枠(`admin`)= 利用者の枠 + `/admin` の下。`/api` の下はどの枠にも入らない
- 配線: root の `src/app/layout.tsx` が `clientGateState("user")` を `src/wiring/AppProviders.tsx` に渡し、AppProviders が一番外で `GateProvider` で包む。admin の守りの layout(`src/app/admin/(protected)/layout.tsx`)が guard の後に `clientGateState("admin")` で包み直す。管理の住所は守りの後にだけ渡すので、公開ページの HTML に出ない(`/admin/login`・`/admin/setup` は利用者の枠)。root layout はクライアント遷移で描き直されないので、枠の切替は入れ子の Provider で行う
- `clientGateState`・`GateProvider` は配線用。使えるのは上の 4 ファイルだけ(lint `feature-gate-entries`)。画面・部品は `useGate()` を使う
- 範囲の外の住所・Provider の外で聞くと、dev(段階が development、`@/lib/appEnv`)は throw(書き間違いに気づかせる)、本番は閉とみなす: `enabled` は false、`path` は `{ open: false, rule: null }`、`filter` は内部の住所の項目を除く(外部 URL・住所の無い項目は残す)
- 値は deploy で決まる config から作るので、ページを開いた時点の値のまま(クライアント遷移では計算し直さない)

## リンク(棚の Link・GatedLink)

閉じた機能へのリンクは自動で消える。新しい機能(規則)を足しても、既存のリンク箇所は書き換えない。

- 棚の Link(`@/components/Navigation` の `Link`、next/link の包み)と `LinkButton`: 棚の口 `LinkVisibilityProvider` に `GateProvider` が判定を差し込む。`gate` prop: `auto`(既定、判定に従う)・`always`(閉じていても描く逃げ道)・`hide`(描かない)。棚の README: `src/components/Navigation/Link/README.md`
- `GatedLink`(`@/featureGate/client`): 同じ判定で描かない。棚の口の差し込みに依らない(口を別の判定で包み直した場所の中でも門番の判定で隠す)
- 隠すのは「`/` で始まる内部の住所で、今の枠の中の、`redirectTo` の無い閉じた機能の住所」だけ(判定 `tools/client/linkHidden.ts` → `hiddenHref.ts`、`gate.filter` と同じ)。外部 URL・`redirectTo` 付きの閉・枠の外(利用者の枠で `/admin`)・Provider の外は描く(`useGate` と違い throw しない)
- server component の中から使ってよい(client 部品として Provider の中で SSR され、判定が効く)。server 版の GatedLink は作らない
- `next/link` の直 import は lint `import-boundaries/link-via-shelf` が知らせる(上流 error、fork は規則の住所の字面に当たるファイルだけ warn。字面に出ない住所は見えない限界: 棚の Link の README)

## 機能を閉じる規則

機能(人が開け閉めする単位、規則 1 本)を閉じると、その住所と、どの開いた機能にも使われなくなったドメインの表・汎用 API・cron を**両方から**閉じる仕組み。fork が upstream の機能を「削除せず使わないまま残す」ための土台。

| 部品 | 場所 | いつ効くか | やること |
|---|---|---|---|
| 規則 | `rules/<名前>.ts` の `export const rule` | — | 1 機能 1 ファイル、名前 = ファイル名 = `FeatureName`。`pathPatterns` / `domains` / `dependsOn` / `enabled()` / `redirectTo` |
| 一覧 | `extensions/rules.ts`（生成物、型 `GeneratedFeatureRule`・`GatedDomain`・`GatedCronTask`・`GatedSettingSection`） | — | 規則 + 名前 + `dependsOn`(字面の写し、書かない規則は空) + 説明用の表名・汎用 API・設定の節・cron の住所(`tables`・`domainApiPaths`・`settingPaths`・`cronPaths`。`pathPatterns` には足さない)。ドメインの表 `domains`(表・汎用 API の住所・持つ機能)・cron の task の表 `cronTasks`(住所・読むドメイン)・設定の節の表 `settingSections`(住所・名指す機能)も出す。読み手は入口(`gate`・`node.ts` の `rules`)を通してこれだけを読む |
| ルートゲート | `src/proxies/featureGate.ts`(`gate.path` を呼ぶ) | リクエストごと | `pathPatterns` に一致するページを `/404`、API を 404 にする |
| API の部品工場 | `src/wiring/apiRoute.ts` が `gate.path` を Factory の口 `gate` に結ぶ | API のリクエストごと | 閉じた住所の API は Factory も 404(proxy の安全網。`src/lib/routeFactory/README.md`) |
| スキーマゲート | `node/gatedSchema.ts`（`@/featureGate/node` の `gatedSchema`、`pnpm db:push` / `db:push:check`） | push のとき | 導いた表を push 対象から外す |
| 検査 | `pnpm test src/featureGate scripts/structure/proxies`・`pnpm check extensions` | CI / 手元 | 書き漏れ・書き間違い・常時実行の入口の閉じ漏れ |

### 規則の書き方

```ts
// src/featureGate/rules/wallet.ts
import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: ["/wallet", "/api/me/wallet"], // 汎用 API の /api/wallet・/api/walletHistory は書かない(domains から導く)
  domains: ["core/wallet", "core/walletHistory"], // この機能が使うドメインのフォルダ(D33 で features: から改名)
  defaultEnabled: true, // 入切の上流の既定(必須、true か false、D103)。fork の値は src/config/featureGate/switches.config.ts
};
```

- `pathPatterns` はセグメント境界の前方一致（`/demo` は `/demo-login` を含まない）。`=` を付けると完全一致（`=/mypage` は `/mypage` だけで、fork が `/mypage/<自分のページ>` を足しても巻き込まない）。照合は `src/lib/pathPattern`（門番の判定・ルート地図・pnpm test src/featureGate scripts/structure/proxies が共有）。動的セグメントは書けないので、値が config で決まるなら展開して書く（例: 通貨 slug ごとの `/wallet/<slug>/purchase`）
- **閉じた住所の下の画面・API は一緒に閉じる**（前方一致）。上流の規則の接頭の下に fork が足した画面も閉じる
- `domains` = 規則が閉じるドメインのフォルダ（`src/features` からの相対で `core/<名前>` か `<名前>`、文字列リテラルの配列）。features の地区（`src/lib/districtMap` が見つけるドメイン）でない書き方（無いフォルダ・`core/wallet/entities` のような深い場所・`core` そのもの・`_` で始まる雛形）は生成器が止める。表名は書かない: `pnpm generate extensions`（宣言の `derive: "featureTables"`）が地区の下の全 `pgTable` から導く（地区の地図の読み手 `src/lib/districtMap`、字面・コメントの中は見ない）。fork が上流のフォルダに足した表も上流の規則が拾う。フォルダの一部の表だけを外す書き方は無い。表を持たないドメイン（Firestore 版の `core/chatRoom` など）も書ける: 表は 0 のまま、汎用 API の住所と依存の検査は表のあるドメインと同じに効く
- **汎用 API の住所（`/api/<domain>`）は書かない**: 生成器が `domains` の各フォルダの `services/server/domainEntry.ts` の `domainEntries` のキーから `/api/<キー>` を導き（字面）、生成一覧の `domains` のそのドメインの `apiPaths` に載せる。住所はドメインに付き、ドメインの開閉で閉じる(下の「ドメインの開閉」。規則の `pathPatterns` には足さない、項目の `domainApiPaths` は説明用)。`domainEntry.ts` の無いフォルダは住所を持たない。手書きと重なると `pnpm test src/featureGate scripts/structure/proxies` が知らせる（上流の規則は失敗、fork の規則は表示だけ）。ドメインを足した・キーを変えたら `pnpm generate extensions`（ずれは `pnpm check extensions` が止める）
- **設定の節の住所（`/admin/settings/<key>`）も書かない**: 設定の節（`src/features/core/setting/sections/`）に `feature: "<規則名>"`（か配列）を書くと、生成器が節の住所と名指す機能を生成一覧の `settingSections` に載せる（`scripts/structure/extensions/derive/gateSettingPaths.mjs`）。節自身の判定で、**名指す機能が全部開のときだけ開く**(D34 K4。機能の `pathPatterns` には混ぜない、項目の `settingPaths` は説明用)。閉じたときの `rule` は閉じた名指しの機能のうち一覧の順で最初。管理メニューの行は住所の絞り込みで消える。規則名でない `feature` は生成で失敗
- **cron の task の住所（`/api/cron/<name>`）も書かない**: task.ts・task.override.ts がどれかの規則の `domains` のフォルダを値で import すると、生成器が生成一覧の `cronTasks`(住所・読むドメイン)に載せ、読むドメインが全部開のときだけ開く（`scripts/structure/extensions/derive/featureTables.mjs`、目録 D10・D34 K4。項目の `cronPaths` は説明用）。規則に `/api/cron/` を手書きすると生成で失敗
- **上流の既定**(設定 D115): 上流は付け足しの機能を閉じて出荷し、土台の画面は開いたまま。閉 = wallet・payment・coupon・referral・couponAttributionReward・analytics・chatRoom・milestone・deviceFingerprint・fingerprintChallenge・userAcquisition・userLineProfile・userXProfile・sampleDomain・demoPages・demoLogin・pageEntry・pageServices・interactionTracking・userCounter・phoneVerification・pause・pairedDevice・messagingTracking ほか(依存先に従う子も閉)。開 = signup・pageMypage・利用規約などの法務の画面・withdraw ほか。使う機能は fork が `switches.config.ts` で開ける(`pnpm ops features set <名前> on`)。上流の開発は全開スイッチで全部開ける(「全開スイッチ」)
- **入切の値**(D35): 上流の既定は規則の `defaultEnabled`(必須、`true` か `false` のリテラル。型 `FeatureGateRule` で必須、設定 D103。fork が足す規則も書く)、fork の値は `src/config/featureGate/switches.config.ts`(上流は空 `{}` で出荷し出荷後に書かない、`{ <機能の名前>: true|false }` を並べる、型 `FeatureSwitches`、未知の名前・真偽でない値は読み込みで throw)。自分の値 = (switches の値 ?? `defaultEnabled`) && `enabled()`。合成は `ruleList.ts` の 1 か所。ドメインの `config.ts` に入切を置かない(処理の切り替えはドメインの config のまま、設定 D92)
- `enabled` は入切でない開く条件だけ(config の値から導いた値を読む同期関数。例 `bankTransferReview` の「自社振込が選べるか」)。省略 = 条件なし。入切そのもの(人が開け閉めする値)を書かない
- `anyOf` = どれか 1 つが開なら開く機能の並び(OR、D36。例 `mypageOther` = 休会か退会)。`dependsOn` と両方あれば両方を満たすとき開
- `dependsOn` = この機能が使う機能の名前(規則のファイル名)の並び。下の「機能どうしの依存(dependsOn)」
- `redirectTo` を指定すると 404 の代わりにそこへ rewrite する（例: サインアップ停止中の `/signup-closed`）
- **同じ住所を 2 つの機能に書かない**(URL は 1 つの機能にだけ属する。D25): 親と子が同じ画面を閉じたいときは親から消して子が親に `dependsOn` する(親を閉じれば子も閉じる)。上流に残る組は理由つきの表だけ(`checks/ruleChains.test.ts`)。重なった住所の答え(`rule` と `redirectTo`)は当たった閉じた住所のうち一番細かい一致(同じ細かさはファイル名の順)。上流の規則どうしの行き先の違う重なりは `pnpm test src/featureGate scripts/structure/proxies` で失敗、fork の規則と上流の重なりは表示だけ
- 上流の規則を fork が上書き・無効化する口は無い（fork は閉じる規則を足すだけ）

### ドメインの開閉(表・汎用 API・cron)と設定の節

- ドメイン = どれかの規則の `domains` に載るフォルダ(生成一覧の `domains`: フォルダ・表・汎用 API の住所・持つ機能)。**開 = そのドメインを `domains` に持つ機能のどれかが開**(1 つのドメインを複数の機能に書いてよい。D24)。どの機能にも載らないドメインは基盤として常に開
- ドメインの開閉で決まる物: 表(`pnpm db:push` / `db:push:check`・`pnpm ops db seed`・`pnpm ops db clear`)・汎用 API の住所(`apiPaths`)・cron の task(`cronTasks`、読むドメインが全部開のとき開)
- 評価は `ruleList.ts`(`closedDomainsOf`・`domainEnabled`・`closedDerivedEntries`・`closedDomainTables`)。機能の開閉は渡した一覧で読む: `rules` なら全開スイッチを通し、`configRules` なら規則の値だけ
- 設定の節(`settingSections`)は節自身の判定: 名指す機能が全部開のときだけ開く(導出の住所の 1 種、`closedDerivedEntries`)
- 住所で覆うかを見る検査(依存の検査・常時実行の入口・ルートの被覆)は、その機能だけを閉じたときの閉じた住所(手書き・導出・依存元の住所、評価そのもの `coveredPatternsOf`)に `pathPatterns` を置き換えた写し(`withCoveredPatterns`)で見る。1 つのドメインを複数の機能が持てば、機能 1 つを閉じてもそのドメインの住所は数えない

### 機能どうしの依存(dependsOn)

```ts
// 紹介の報酬はウォレットを使う: ウォレットが閉なら報酬も閉(自分の値が開でも)
export const rule: FeatureGateRule = {
  pathPatterns: ["/mypage/invite/rewards"],
  dependsOn: ["wallet"],
  enabled: () => REWARD_CONFIG.enabled, // 例。省略すれば「自分は開、依存先しだい」
};
```

- 機能が開く = 自分が開 && `dependsOn` の機能が全部開(推移的、全部 AND)。親が閉じれば子・孫も閉じ、その住所・表・汎用 API・設定の節・cron も閉じる(閉じた機能と同じ扱い)
- 書き方: 文字列リテラルの配列(機能の名前を直接書く。型は `FeatureName[]`)。生成器(`pnpm generate extensions`、`scripts/structure/extensions/derive/gateDependsOn.mjs`)が字面で読み、**未知の名前・自分・重複・輪(推移的)・文字列リテラルの配列でない書き方**を規則の名前を出して止める
- 評価は `ruleList.ts` の 1 か所(`resolveFeatureOpen`)。答えの意味:
  - `ruleEnabled(rule)`(門番の口・`rules` の `enabled()`): (全開スイッチで開いている || 規則の値) && 依存先が全部開
  - `configEnabled(name)`(`configRules` の `enabled()`): 規則の値 && 依存先の規則の値が全部開(スイッチを通さない)
  - `ownEnabled(name)`: 規則の値そのもの = (switches の値 ?? `defaultEnabled` ?? 開) && `enabled()`(全開スイッチも依存先も通さない。`pnpm ops features list` の閉の理由)
  - `isOpenedBySwitch(name)`: 全開スイッチがその名前を開けているか(依存先は見ない。開くかは `ruleEnabled`)
- **requires の被覆**(生成で止める、D24・D34 K5。`scripts/structure/extensions/derive/gateRequires.mjs`): 機能 X の `domains` のドメインが `requires`(domainEntry.ts)するドメインは、X の `domains`・X の依存先(推移的)の `domains`・基盤(どの機能にも載らないドメイン)のどれかに無ければ止める。直し方は X の `dependsOn` にそのドメインを持つ機能を足す。上流の例外は理由つきの縮む表(今は 0 行)
- **住所の検査**(読み込み後の一覧で、`node/addressCheck.ts` の `checkAddresses`、検査は `pnpm test src/featureGate scripts/structure/proxies`): 同じ住所を 2 つの機能が持つ(手書き・汎用 API・cron・設定の節の全部で)、親の前方一致の下の住所の機能が親に `dependsOn` していない(推移的で可)、を止める(D25・D31)。fork の規則も同じ(上流の住所の下に足した規則は上流の機能に `dependsOn`)。依存の根拠が無い入れ子は両方に依存する小さな機能へ(D34 K3)。上流の例外は 0(理由つきの縮む表 `ADDRESS_EXCEPTIONS`)
- **組み合わせの検査**(test で止める、`checks/integrity.mjs`、実物は `scripts/structure/proxies/featureGate.test.mjs`): 機能をまたぐ外部キー(ドメインの `requires` と機能の `dependsOn` の両方で覆う。規則の中の外部キーと参照先が基盤のものは対象外、設定 D56)・どの機能にも載らないドメイン(基盤)の `requires` の先が閉じうる・必須の機能(`required/`)が規則の値で閉、を止める。共有のドメインが別の機能で開いたままは落とさず warn し、`pnpm ops features list` の閉じた機能に出す(`sharedDomainsOpen`)。上流の例外は 0(テスト内の縮む表)
- 全開スイッチの名前指定は依存先を開けない(「全開スイッチ」の節)
- `pnpm ops features list` は依存先・依存元(推移的)・閉の理由を出し、`pnpm ops features set` は必須の機能が依存する機能の off を止める(下の節)

### 例 4 つ(D30)

```ts
// 1. 単体のドメインの機能: 1 つのドメインと、その画面・API
export const rule: FeatureGateRule = {
  pathPatterns: ["/admin/milestones", "/api/me/milestones"],
  domains: ["core/milestone"],
};

// 2. 複数のドメインを組む機能: 部品のドメインを並べ、使う機能に依存する
export const rule: FeatureGateRule = {
  dependsOn: ["wallet"], // 購入は残高に積む(purchaseRequest の requires と外部キーも覆う)
  pathPatterns: ["/api/webhook/payment", "/api/wallet/purchase"],
  domains: ["core/purchaseRequest", "core/bankTransferReview", "core/purchaseQuota"],
  defaultEnabled: true,
};

// 3. 画面だけの機能: ドメインを持たず、住所だけを閉じる(=/ は完全一致で fork が下に足したページを巻き込まない)
export const rule: FeatureGateRule = {
  dependsOn: ["pageMypage"], // マイページの画面の一部
  pathPatterns: ["=/mypage/account/email"],
};

// 4. fork が上流の機能の住所の一部を閉じる機能: 上流の住所の下に住所を持つので上流の機能に dependsOn する(住所の検査が求める)
// src/featureGate/rules/friendCouponAdmin.ts(fork の名前)
export const rule: FeatureGateRule = {
  dependsOn: ["coupon"],
  pathPatterns: ["/admin/coupons/friend-coupon"],
  defaultEnabled: false,
};
```

- 依存の根拠の無い入れ子(親の住所の下にあるが、子の機能は親に依存しない)は、親と子の両方に依存する小さな機能に住所を持たせる(`enabled`・`defaultEnabled` を書かない = 両方が開のとき開。例 `demoSampleDomain`・`walletAnalytics`・`mypageInvite`、D34 K3)

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

### 決まりごと

- **ゲート対象のドメインにルートを足したら、同じ規則の `pathPatterns` に追記する**（表は `domains` のフォルダから自動で入る）。`pnpm test src/featureGate scripts/structure/proxies` が次を検査する:
  - 導いた表名が schemaRegistry に実在する（走査の表の集合 = schemaRegistry の全表は `pnpm test scripts/structure/registry/`）
  - **今 `enabled()` が false の規則について**、その規則の `domains` のドメイン（表の数は問わない）を import するルート（route.ts / page.tsx と `_screen/` `_components/` 配下）が、その規則の `pathPatterns` で閉じている（判定 `checks/routeImports.mjs`。`domains` の無い規則は対象外）
  - 同じく、そのドメインの汎用 CRUD（`/api/<domain>`）が閉じている
  - 現在のフラグで、外す表を残す表が外部キーで参照していない
  - 常時実行の入口の閉じ漏れ（下）
- **有効な機能のルートは検査しない。** 開いていて正しいので、その機能を土台にした fork は何も宣言しなくてよい。機能を切ると、その機能に依存するルートと外部キーがテストで一覧になる（= 切る前に直す場所）
- **`FEATURE_GATE_CHECK=all pnpm test src/featureGate scripts/structure/proxies` は upstream も fork も実行する。** 全規則を無効とみなし、全機能 false でスキーマゲートが成立することも検査する(fork が `required/` で必須と宣言した機能とその dependsOn の先は、`pnpm ops features set` が閉じないので開いたまま扱う)。意図的に閉じない upstream のルートはテスト内の `ROUTE_EXCEPTIONS`、fork の例外は `alwaysOnExceptions/<名前>.ts` に理由付きで書く
- **サンプルのドメイン**（`sampleDomain`、規則の `defaultEnabled: false`）: 上流の既定 閉（上流の開発は全開スイッチで開ける。fork が見るなら開ける）。権限は公開読み・ログイン済みの更新・子の画像のログイン済みアップロードのままで厳しくしない → **実際の利用者がいる fork は閉じる**(`pnpm ops features set sampleDomain off` = `src/config/featureGate/switches.config.ts` に `sampleDomain: false`): 管理画面・`/api/sample*` の汎用 API・サンプルを読むデモ画面 4 つ(`demoSampleDomain`)が 404、5 表（samples ほか）は db:push で作らない（既存の表と行は消さない）。管理のメニューの行は残る
- **機能どうしの前提**: payment は wallet を前提にする（`purchase_requests` → `wallet_histories` の外部キー。push 時に例外になる）。referral は coupon を前提にする（招待コードの実体はクーポン。テストで検査）

### 常時実行の入口

ゲートが閉じるのはその機能自身のルートとテーブルだけ。常に動く処理（cron・退会の後片付け・集計の照合・常に読み込まれる結線）が無効な機能を使うと、テーブルが無くて失敗する。`pnpm test src/featureGate scripts/structure/proxies` が全規則を無効とみなして次を見る（判定: `checks/alwaysOnEntries.mjs`）:

| 入口 | 閉じ方 |
|---|---|
| cron の `src/app/api/cron/<name>/task.ts` | タスクの住所 `/api/cron/<name>` を、import する機能のフォルダを `domains` に持つ規則の全部が `pathPatterns` で覆う。住所は生成器が task.ts・task.override.ts の import から導いて規則の `cronPaths` に足す（規則に手書きしない、目録 D10。閉じた機能のタスクは route = `@/wiring/cronRoute`・`pnpm task`・`pnpm generate cron` が住所で飛ばす。task.ts に機能の入切は書かない。`src/lib/cron/README.md`「機能の門」） |
| 宣言に `alwaysOn: true` の拡張点の項目（`cleanupHandlers`・`coinIssuanceSources`・`rollupMetrics`） | 項目に `enabled` |
| fork の手書きの登録表（下の `registries`） | 使い所を `...(<フラグ> ? [x] : [])` で包む |
| 常に読み込まれる結線（`src/app/layout.tsx`・`src/wiring/**`・`src/proxies/**`・`src/featureGate/**`） | import しない。避けられないものは理由付きの例外表 |

- 規則のファイル（`rules/<名前>.ts`）が機能のドメインの入切の値 `@/features/<d>/config`（`config.ts`、値だけ）を読むのは閉じ漏れに数えない（入切でない条件の値、例 決済の自社振込が選べるか。入切そのものは規則の `defaultEnabled` と `switches.config.ts`）。`config.ts` が値の外（services・drizzle・server-only）に届くと到達の検査 `pnpm test src/featureGate/checks/reachability.test.mjs` が止める

- 上流の例外表はテスト内の `ALWAYS_ON_EXCEPTIONS`（縮む表。当たらなくなった行は失敗）
- **fork の分は 1 項目 1 ファイルの受け口に理由つきで**: `alwaysOnExceptions/<名前>.ts`(名前は英字始まりの英数字、fork の印は付けない。宣言の点 `alwaysOnExceptions`・`alwaysOnRegistries`)
  ```ts
  // src/featureGate/alwaysOnExceptions/storeMembers.ts(常に読み込まれる結線の例外)
  import type { AlwaysOnException } from "@/featureGate";
  export const exception: AlwaysOnException = { file: "src/wiring/storeMembers.ts", reason: "<閉じなくてよい理由>" };
  // src/featureGate/alwaysOnExceptions/storeCleanup.ts(fork の手書きの登録表)
  export const registry: AlwaysOnException = { file: "src/registry/storeCleanup.ts", reason: "<常に読まれる理由>" };
  ```
  1 ファイルに `exception` か `registry` のどちらか 1 つ(生成器が止める)、`reason` は必須、縮む表の規則は fork の行にも掛かる。旧い置き場 `scripts/proxies/alwaysOnExceptions/<名前>.mjs`・`scripts/proxies/alwaysOnExceptions.<x>.mjs` は止まり、移し方を案内する(`.notices/20261104-173649-feature-gate-relocate.feature-gate-relocate.mjs`)
- 限界: 直接の import だけを見る（別のモジュールを経由した到達は見ない）。`enabled` の式が本当にその機能のフラグかは見ない
- 上の外にも呼び出し側でフラグを見る経路がある（登録時の招待コード消し込み `auth/services/server/registration.ts`、管理画面ユーザー一覧の残高調整 `user/components/admin/*UserList/Table.tsx`）。サービスの層で止める仕組みは別の議題

### fork での使い方

- upstream の機能を使わない: その機能のフラグを false にする。ルートは 404、テーブルは作られない。コードは削除しない
- upstream の画面を使わない: 画面を消したり `_` 付きに rename したりせず（所有の検査で違反、src/lib/forkOwnership/README.md）、その画面の機能(`pageMypage`・`pageEntry`・`pageServices`・`pageTerms` ほか規約 3 種・`adminDemoUsers` など)を `pnpm ops features set <名前> off` で閉じる(`src/config/featureGate/switches.config.ts` に書かれる)。止めたページはルート地図に `gated-off(<pattern>)` と載る。置き換えたいときは止めずに 1 行スイッチで `_components/` の Screen へ向ける。マイページのアカウントの項目(メール・パスワード・プロフィール・電話番号)は機能でなく user の設定 `account.editableItems` で選ぶ(`src/features/core/user/README.md`)。チャットの管理画面は親の機能(`chatRoom`)の住所で子のスイッチは無い(設定 D104・D119)。機能は使い管理画面だけを閉じたい fork は、その住所だけを持つ自前の規則(`defaultEnabled: false`)を足す(上流の住所と重なるのは表示だけで止まらない)。ユーザータグは規則を持たない常時開の基盤(D64)
- スイッチの無い upstream の画面を止めたい: upstream に依頼する（`/order <親>`）。fork の規則で upstream の画面を止めない（upstream の規則と重なり、merge のたびに見直しになる）
- 新しいドメインを機能として閉じられるようにする: ドメインを作り(`pnpm forge`)、`rules/<機能の名前>.ts` に規則を手で書いて `domains` にそのドメインのフォルダを入れる(管理画面の住所は `pathPatterns`、入切の既定は `defaultEnabled`)→ `pnpm generate extensions`。汎用 API・表・cron は導出に任せる。domain.json の `closable`(閉じられる形の印)と 1 対 1 のひな形はなくした(D26。書くと生成器が案内して止める)。どの機能にも載らないドメインは基盤として常に開
- fork 自身の機能を閉じたい: `rules/<名前>.ts`(上流の規則と違う名前)に規則を 1 つ置き、`pnpm generate extensions`。upstream の機能と一緒に開閉させるなら `dependsOn` に upstream の機能を書く（例: `dependsOn: ["payment"]`）。入切の既定は `defaultEnabled`、値を変えるのは `switches.config.ts`
- 機能を切ったら `pnpm test src/featureGate scripts/structure/proxies` が列挙するルート・表・入口を、規則に入れるか、呼び出し側でフラグを見る
- ウォレットと購入を外す(規則 `wallet` と `payment` を閉じる): core を編集しなくてよい。画面・汎用 API・自前の API・webhook・cron(`wallet-*`・`expire-pending-purchases`)の住所が閉じ、常時実行の項目(一括調整のジョブ・退会の後片付け・コイン発行の源)が止まり、管理メニューの行と利用者の管理一覧の残高調整・coupon の購入割引のカテゴリが消える(`checks/walletOff.test.tsx`、`pnpm test src/featureGate/checks scripts/structure/proxies/walletOff.test.tsx`)
- 区切り gate-s3 の取り込み: 依存の検査が fork でも落ちる。codemod `.notices/20261105-112509-feature-gate-automation.feature-gate-s3.mjs` が今開いている機能の違反を `required/` に書き出し、cron の route.ts の import を直す(`.notices/README.md` の codemod の節)

### pnpm ops features list / pnpm ops features set

道具は門番の `node.ts`（`readFeatureReport`・`planFeatureSet`、`node/describe.ts`・`node/setEnabled.ts`）。scripts はそれを呼ぶだけ（`scripts/operations/features/`）。

- `pnpm ops features list [--name <規則名>] [--json]`: 規則ごとに開閉(規則の値 = switches ?? 既定 && 条件)・必須（`required/`）・住所（手書き / 汎用 API の導出 / 設定の節の導出）・機能のフォルダ・表・依存（閉じられるフォルダを外から値で読むファイルと、許された形。依存の検査の走査そのもの。許されていない依存は「未」と出る）・名前の呼び出し箇所（`gate.enabled` / `gate.assert` / `useGate().enabled` の字面の `"<名前>"`。変数で渡す名前は見えない）・機能どうしの依存(依存先 `dependsOn` とその推移 `dependsOnAll`・どれか `anyOf`・依存元(推移的)`dependedOnBy`・閉の理由 `closedBy` = 自分の値 / 閉じた依存先の名前。表の開閉は「閉(依存先 <名前> が閉)」と出す)・全開スイッチの名前指定の足りない名前(`switchMissing`)。どれも `--json` に載る(依存のファイルの欄 `dependents` とは別)。読むだけ
- `pnpm ops features set <規則名> on|off`: 書き先は Tier で決まる(D35): fork = `src/config/featureGate/switches.config.ts` の `export default { … }` の直下の `<名前>: true|false`、Tier1 = 規則のファイルの `defaultEnabled`(どちらも無ければ足す。値はいつも `true|false` を書き、既定と同じでも消さない。L1.26)。リテラルでない値などは何も書かず理由を出して exit 2(手で直す)。必須の機能を off にしようとすると何も書かずに exit 1。必須の機能が `dependsOn` で推移的に依存する機能の off も何も書かずに exit 1(必須の機能からの依存の連鎖を出す)。on にした機能の依存先が規則の値で閉なら、値は書いた上で「依存先 <名前> が閉なので閉のまま」と出す(L3.1)
- `pnpm ops features set` は `db:push`・`pnpm generate extensions` を打たない（表を持つ機能を開けたら `pnpm db:push` は人が打つ）

### 依存の検査

閉じられるフォルダ(規則の `domains`)を、そのフォルダの外から値で import するファイルは、次のどれかでなければ `pnpm test src/featureGate scripts/structure/proxies` が落ちる(判定: `checks/dependencies.mjs`):

1. 自分のドメインの `services/server/domainEntry.ts` の `requires` に相手のドメインの名前がある(`requires: ["wallet"]`、文字列リテラルの配列で書く。字面で読む)。名前はドメインのフォルダ名だけ(`core/` は付けない)。`domainEntries` のキーは汎用 API・表の資源の名前でドメインの名乗りにならない(フォルダ名と違うキー、例 `auditLogFailed` を書いても当たらない)。ドメイン・requires の読み手は `src/lib/districtMap`
2. ファイルが規則の名前で確かめる: `gate.enabled("wallet")`・`gate.assert("wallet")`・`useGate().enabled("wallet")`
3. ファイルが src/app の下で、その規則の `pathPatterns` が覆う住所にある(page・loader・route・`_screen`・`_components` など。閉じれば一緒に閉じる)
4. 同じ規則のフォルダどうし
5. fork の `required/<規則名>.ts` がある(この fork はその機能を必ず使う = 依存を書いたとみなす)
6. 例外: `dependencyExceptions/<名前>.ts` に理由つきで(字面で判定できない物: 動的 import の結線・wiring の遅延 import など)。上流の例外は 0(上流の結線は確かめる側で通す。例: `src/wiring/apiRoute.ts` は端末の束を `gate.enabled("pairedDevice")` で結ぶ)

- 数えない: 生成の一覧(`src/registry`)・`src/featureGate`・テスト・型だけの import。動的 import と副作用 import は数える
- 上流の違反は 0(全 Tier で同じ検査。上流の縮む表は 0 行になって表ごと消した)
- 強さ: 全 Tier で落とす(区切り gate-s3 から。gate-s2 の間は Tier1 でない repo では表示だけだった)。fork の移行は codemod `.notices/20261105-112509-feature-gate-automation.feature-gate-s3.mjs`(今開いている機能の違反を `required/<規則>.ts` に書き出す。閉じた機能の違反は一覧に出すので手で直す。`.notices/README.md` の codemod の節)
- 限界: 字面だけを見る。別のモジュールを経由した到達、2 の呼び出しが import の使い所を本当に守っているか、機能どうしの前提(payment が閉じれば wallet の画面も閉じる等)はたどらない

### 門 build の検査(pnpm check proxies: 機能を要する設定の値・明示的に開けた子)

設定の値が機能を前提にするのに、その機能が規則の値で閉の組み合わせ(例 wallet の `purchaseRestriction: "phoneVerified"` で `phoneVerification` が閉)は、門 build の `pnpm check proxies`(`scripts/structure/proxies/check.ts`、門番の検査をビルドで止める入口、設定 L1.44)が失敗にする。判定は `checks/featureRequirements.ts`(地区の地図の宣言 → 持ち主の defineConfig の定義に上書きを合成した値 → `configEnabled`、全開スイッチは通さない)。宣言の書き方: `src/config/README.md`「持ち主の宣言 featureRequirements」。テスト `FEATURE_GATE_CHECK=all pnpm test src/featureGate/checks/featureRequirements.test.ts`

同じ入口で、fork が `src/config/featureGate/switches.config.ts` で明示的に `true` にした機能の `dependsOn` の先(推移的)が規則の値で閉なら失敗にする(設定 D121、`checks/explicitChildren.ts`。開けたつもりの子が親のせいで黙って閉のまま、を止める)。直し方は親を開けるか子の行を消す。上流の既定 `defaultEnabled: true` の子(switches に書いていない物)・`anyOf` は対象にしない。テスト `FEATURE_GATE_CHECK=all pnpm test src/featureGate/checks/explicitChildren.test.ts`

### 門番の範囲外

門番が閉じるのは、規則の住所(ページ・API)・表・常時実行の入口・リンクとメニュー・依存の検査が見る import まで。次は門番では止まらないので、その機能の側で閉じる:

- 他のドメインの画面の中の細かい出し分け(欄・ボタン・文言の一部): その画面が `useGate().enabled` / `gate.enabled` で確かめる
- API を通らない書き込み・読み出し: client から直に Firestore に書く処理、外部サービスの webhook を自前で受ける処理など(住所で閉じないので、規則の住所の外で動く)
- 規則の `enabled` の式が本当にその機能の入切かは見ない

## 全開スイッチ(FEATURE_GATE_OPEN)

閉じた機能を env 1 つで開ける(上流の開発・デモで全機能を見る、fork の開発で sample を見る)。規則の値(config)は書き換えない。

```bash
FEATURE_GATE_OPEN=all              # 全規則を開く
FEATURE_GATE_OPEN=coupon,wallet    # 名前の規則だけ開く(区切りは , と空白。名前 = rules/<名前>.ts)
```

- 未設定・空 = 規則の値のまま。未知の名前は判定のたびに throw(打ち間違いを黙って閉じたままにしない。proxy では全リクエストが失敗するので、置いたらすぐ気付く)
- 効く条件: 段階(`@/lib/appEnv` の `getAppEnv()`、決まりは [src/lib/appEnv/README.md](../lib/appEnv/README.md))が `development` なら全 Tier。staging・production(値なし・知らない値も)は **Tier1 だけ**。効かない所(fork の本番など)では値を読まない(置かれていても落とさない)
- Tier1 の判別(`openSwitch.ts` の `isTier1Build` 1 つ): Next のビルドは `next.config.ts` が fork_id(`readForkIdentity().isTier1`)から計算して埋め込む `FEATURE_GATE_TIER1`(fork の build では `"false"`。埋め込みが勝つので Vercel の env では上書きできない)。注入の無い node(scripts・テスト)は `node.ts` が読むだけで渡す読み手 `node/tier1.ts`。`openSwitch.ts` は proxy の束に載るので `node:` を読まない
- **名前指定は依存先を開けない**(D34・L3.1): `FEATURE_GATE_OPEN=<子>` で親が閉なら子は閉のまま。足りない名前(名前で開けた機能の推移的な依存先のうち、スイッチにも無く規則の値も閉の物)を値ごとに 1 回 `console.warn` し、`pnpm ops features list` に出す(`switchMissing`)。開けるなら依存先も名前に足す(`all` は全部開くので関わらない)
- 判定の入口は `ruleList.ts` の 1 つ: 生成一覧の各規則の `enabled` を「(スイッチで開いている || 規則の `enabled()`) && 依存先が全部開」に差し替えた `rules`。門番の口・`clientGateState` はこれを読み、client は server の答えを受け取るだけ(client で env を読み直さない)

上流(Tier1)の開発の約束: 上流は付け足しの機能を閉じて出荷する(設定 D115)ので、上流の開発の env(`.env.development`、git に入らない)は `FEATURE_GATE_OPEN=all` を置く。

- 置かずに `pnpm db:push` すると、閉じた機能のドメインの表は一覧に載らず、drizzle が DROP を提案する(push の前に `pnpm db:push:check` の差分を読む)
- `route-map.jsonl` の閉(`gatedOff`)と cron(`vercel.json`)は規則の値(本番の値)で書く。スイッチで開けても揺れない
- fork の既定は空(規則の値のまま)。fork は使う機能を `src/config/featureGate/switches.config.ts` で開け、スイッチは開発で sample を見るときだけ使う

道具ごとの効く範囲(L2.3):

| 道具 | スイッチ | 読む物 | 理由 |
|---|---|---|---|
| 門番の口(`gate.*`)・proxy・`useGate()` | 効く | `rules` | 開けた機能の画面・API を見る |
| `pnpm db:push` / `db:push:check` の表 | 効く | `rules` | 開けた機能の表を作る(開発の DB だけ。`ENV_FILE` の env ファイルの `APP_ENV` で決まる: `.env.development` なら全 Tier、`APP_ENV=production` か値なしのファイルなら Tier1 だけ) |
| `pnpm ops db seed`・`pnpm ops db clear` | 効く | node の `gate.enabled`・`closedTables(rules)` | 表と同じ答え |
| 受入のテスト `pnpm e2e` の skip(`tests/e2e/featureGate.ts`) | 効く | `rules` | サーバーと同じ答え。runner は `playwright.config.default.ts` で開発の env(`ENV_FILE`、既定 `.env.development`)を読む |
| `pnpm ops features list` | 見せ方 | `rules` + `configEnabled` + `ownEnabled` + `isOpenedBySwitch` + `switchMissingDependencies` | 規則の値で閉・スイッチで開を「閉 → 開(スイッチ)」と出す。名前指定で開けたが依存先が閉なら足りない名前を出す。`--json` は `enabled`・`configEnabled`・`ownEnabled`・`openedBySwitch`・`switchMissing` |
| `pnpm generate cron` / `pnpm check cron`・`pnpm task` | 効かない | `configPath` | `vercel.json` と照合が env で揺れない。スイッチで開けた機能の cron は `vercel.json` に載らない(route は開くので手で叩けば動く) |
| `pnpm generate routes` | 効かない | `configRules` | コミットする `route-map.jsonl` が env で揺れない |
| `FEATURE_GATE_CHECK` の検査・依存の検査・codemod `feature-gate-s3` | 効かない | `configRules` | 検査の答えが env で揺れない |
| `pnpm ops features set`・`required/` | 関わらない | config の字面 | 規則の値を書く道具 |

検査: `scripts/structure/proxies/openSwitch.test.ts`(値・効く条件・Tier1 の判別・依存の連鎖と名前指定の足りない名前・範囲の表・入口の字面の検査・`next.config.ts` の注入)。依存の評価・説明・set の計画の単体は `src/featureGate/checks/dependsOn.test.ts`、生成器の検査は `scripts/structure/extensions/extensions.test.mjs`。

## 守り

- lint `import-boundaries/feature-gate-entries`: 外からは入口 3 つだけ・lib は読まない・`node.ts` は scripts とテストだけ・配線用の `clientGateState`・`GateProvider` は配線の 4 ファイルだけ(`eslint-rules/import-boundaries.mjs`)
- 到達の検査 `pnpm test src/featureGate/checks/reachability.test.mjs`: `index.ts`・`client.ts` から値の import をたどり、features の services・`src/lib/drizzle`・DB のパッケージ・`server-only`・`node:` に届いたら鎖を示して落とす(門番は proxy と client の束に載る。規則は config だけを読む)。`client.ts` からは規則・規則の一覧・評価(`evaluate.ts`・`clientState.ts`)・config にも届かない(client は規則を評価しない)。proxies の鎖(`src/proxy.ts`・`src/proxies/index.ts`)からは、たどり着いた config(`src/config/**`・地区の `config.ts`・`*.config.ts`)の先だけを同じ禁止の先で見る(proxies の項目は任意のドメインの config を読んでよいが、config は値だけ。鎖そのものの services は判定しない。目録 D20)
- lint `page-authz/session-api-callsite` は `src/featureGate/**` にも掛かる(規則と判定はセッションを解かない)
- 所有の検査(`pnpm workflow ownership check`): fork が受け口の外(`rules/`・`alwaysOnExceptions/`・`dependencyExceptions/`・`required/` の外)へ足したファイルは `gate-add` で違反(`src/lib/forkOwnership/README.md`)

## 旧い置き場からの移行(fork)

旧い置き場(`src/proxies/featureGateRules/`・`scripts/proxies/alwaysOnExceptions/`・`src/proxies/pathPattern.mjs`・`scripts/structure/registry/schemaGate.ts`・生成一覧 `src/proxies/extensions/featureGateRules.ts`)からの移し方は `node .notices/20261104-173649-feature-gate-relocate.feature-gate-relocate.mjs`(dry-run → `--apply`、`.notices/README.md` の codemod の節)。旧い型 `@/proxies/types` の `FeatureGateRule`・`GatedFeatureRule` の再 export は区切り gate-s3 で消した(型は `@/featureGate` から。この道具が直す)。
