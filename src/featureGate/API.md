# src/featureGate — API

## Overview

featureGate の README の API を分けた文書(README が 20,000 字を超えるため)。入口と gate の口・client の口・リンク・規則の書き方と依存。言葉と置き場は `README.md`、仕組みは `Internals.md`。

## API

### 入口と gate の口

外からは入口 3 つだけを読む(lint `import-boundaries/feature-gate-entries`、全 Tier error)。lib は門番を読まない(値も型も。規則や判定は引数で受ける)。`node.ts` は scripts とテストだけ。テストは中の部品を読んでよい。

```ts
import { gate, type FeatureName } from "@/featureGate";

gate.enabled("wallet");        // 規則 rules/wallet.ts の enabled の答え。未知の名前は型で落ち、実行時は throw
gate.assert("wallet");         // 閉じていれば DomainError(404、決まった文言)を投げる。開いていれば何もしない
gate.path("/wallet/history");  // { open: true } | { open: false; rule: FeatureName; redirectTo?: string }
gate.filter(menuItems);        // 閉じた機能の住所を指す項目を除く(既定は item.href、順は保つ)
gate.filter(rows, (row) => row.link); // href を持たない型は住所の取り出し方を渡す(型で必須)
gate.domainOpen("wallet");     // ドメイン(src/domains/<名前> か core/<名前> のフォルダ名)が開いているか。載せた機能が全部閉なら false、どの規則にも載らなければ true
gate.plugs(routeFactoryDevice);   // plugs の点の生成された一覧から、項目のドメインか requires の相手が閉じた項目を外す(lib の項目 domain null は残す、順は保つ)
```

- `gate.plugs`: ドメインが外の仕組みに差した部品(`<ドメイン>/plugs/<点>/<名前>.ts`、生成された一覧の項目 `{ domain, name, requires, … }` = 型 `GatedPlug`)を使う時に掛ける(D26)。生成された登録表(serviceRegistry など「どんなドメインがあるか」)には掛けない。client は `useGate().plugs`(server が渡す `ClientGateState.closedDomains` で同じ判定)。書式: `scripts/structure/extensions/README.md` の「plugs の点」

- `gate.assert`: service・API が自分で止まるときに使う。文言は「お探しのページは見つかりませんでした」で固定、機能の名前・`code`・`details` は出さない(閉じた機能の存在を利用者に知らせない)。未知の名前は `gate.enabled` と同じく throw
- `gate.path`: 閉じた住所(閉じた規則の手書きの住所 + 閉じたドメインの汎用 API・cron の住所)に当たれば、当たった中で**一番細かい一致**(長い住所、同じ長さは `=` の完全一致。`@/lib/pathPattern` の `patternSpecificity`)の `{ open: false, rule, redirectTo }`(同じ細かさは一覧の順)。導出の住所の `rule`・`redirectTo` は閉じた持ち主の機能のうち一覧の順で最初。読み手は proxy の項目 `src/proxies/featureGate.ts`(応答を作る)と demo の loader(閉じたデモを一覧から外す)
- `gate.filter`: メニュー・一覧から閉じた住所の行を隠すだけ(応答は proxy が作る)。除くのは「`/` で始まる内部の住所(`//` は別オリジンで対象外)で、閉じた住所の並びの順で最初に当たった規則に `redirectTo` が無い」項目だけ。`?` と `#` の後ろは照合から外す。外部 URL・`redirectTo` 付きの閉(行き先の画面がある。例: サインアップ → `/signup-closed`)・住所の無い項目(`getHref` が `undefined`)は残す。判定は `hiddenHref.ts` の純関数で、リンクの自動で隠す判定(client)も同じ関数を使う
- 管理のコマンドパレットの移動の候補は、管理の枠の中の橋 `AdminCommandGateBridge` が渡す厳密な `useGate.path` の判定で絞る(`redirectTo` 付きの閉も隠す。枠の外では絞らない。`src/domains/core/adminCommand/README.md`)
- 管理メニューは `gate.filter` でなく `useGate.path` で隠す(厳密: `redirectTo` 付きの閉も隠す。行き先の画面があっても、閉じた機能の入口をメニューに出さない)。組み立ては `src/domains/core/admin/hooks/useAdminMenu.ts`、仕組みは `src/domains/core/admin/menu/README.md`。メニュー専用のスイッチや項目の `feature:` は持たない
- 既存の読み手(demo の loader・service の自己停止)は `gate.assert` / `gate.filter` へ移す途中(まだ直読み・`gate.path` の箇所がある)
- 中の名前(`isFeatureEnabled`・`resolvePath`)は外に出さない。道具を足すときは `tools/server/<名前>.ts` に 1 ファイル、束 `tools/server/index.ts` に 1 行(client でも使う道具は `tools/client/` にも同じ名前で。束の名前の一致は `checks/gateTools.test.ts`: client の名前 ⊆ server、server だけの名前は `assert` だけ)

### client の口(useGate)

client は規則を評価しない。server が計算した値(`clientGateState(area)` = `{ 規則名: 開閉 }` と枠で絞った閉じた住所の並び)を `GateProvider` で受け取り、`useGate` が読む。

```tsx
"use client";
import { useGate } from "@/featureGate/client";

const gate = useGate;
gate.enabled("referral");        // server の gate.enabled と同じ答え。未知の名前は throw
gate.path("/mypage/invite");     // { open: true } | { open: false; rule; redirectTo? }(範囲の中は server と同じ)
gate.filter(menuItems);          // server の gate.filter と同じ判定(hiddenHref.ts)
gate.plugs(items);               // server の gate.plugs と同じ判定(閉じたドメインの並び closedDomains で)
```

- 枠(範囲): 利用者の枠(`user`)= `/admin` と `/api` の下を除く住所。管理の枠(`admin`)= 利用者の枠 + `/admin` の下。`/api` の下はどの枠にも入らない
- 配線: root の `src/app/layout.tsx` が `clientGateState("user")` を `src/wiring/AppProviders.tsx` に渡し、AppProviders が一番外で `GateProvider` で包む。admin の守りの layout(`src/app/admin/(protected)/layout.tsx`)が guard の後に `clientGateState("admin")` で包み直す。管理の住所は守りの後にだけ渡すので、公開ページの HTML に出ない(`/admin/login`・`/admin/setup` は利用者の枠)。root layout はクライアント遷移で描き直されないので、枠の切替は入れ子の Provider で行う
- `clientGateState`・`GateProvider` は配線用。使えるのは上の 4 ファイルだけ(lint `feature-gate-entries`)。画面・部品は `useGate` を使う
- 範囲の外の住所・Provider の外で聞くと、dev(段階が development、`@/lib/appEnv`)は throw(書き間違いに気づかせる)、本番は閉とみなす: `enabled` は false、`path` は `{ open: false, rule: null }`、`filter` は内部の住所の項目を除く(外部 URL・住所の無い項目は残す)、`plugs` はドメインのある項目を除く(lib の項目は残す)
- 値は deploy で決まる config から作るので、ページを開いた時点の値のまま(クライアント遷移では計算し直さない)

### リンク(棚の Link・GatedLink)

閉じた機能へのリンクは自動で消える。新しい機能(規則)を足しても、既存のリンク箇所は書き換えない。

- 棚の Link(`@/components/Navigation/Link` の `Link`、next/link の包み)と `LinkButton`: 棚の口 `LinkVisibilityProvider` に `GateProvider` が判定を差し込む。`gate` prop: `auto`(既定、判定に従う)・`always`(閉じていても描く逃げ道)・`hide`(描かない)。棚の README: `src/components/Navigation/Link/README.md`
- `GatedLink`(`@/featureGate/client`): 同じ判定で描かない。棚の口の差し込みに依らない(口を別の判定で包み直した場所の中でも門番の判定で隠す)
- 隠すのは「`/` で始まる内部の住所で、今の枠の中の、`redirectTo` の無い閉じた機能の住所」だけ(判定 `tools/client/linkHidden.ts` → `hiddenHref.ts`、`gate.filter` と同じ)。外部 URL・`redirectTo` 付きの閉・枠の外(利用者の枠で `/admin`)・Provider の外は描く(`useGate` と違い throw しない)
- server component の中から使ってよい(client 部品として Provider の中で SSR され、判定が効く)。server 版の GatedLink は作らない
- `next/link` の直 import は lint `import-boundaries/link-via-shelf` が知らせる(上流 error、fork は規則の住所の字面に当たるファイルだけ warn。字面に出ない住所は見えない限界: 棚の Link の README)

### 機能を閉じる規則

閉じると何が閉じるか(住所・使われなくなったドメインの表・汎用 API・cron)は [README.md](./README.md) の Overview。ここは規則の書き方。

- 規則 — 場所: `rules/<名前>.ts` の `export const rule`; いつ効くか: —; やること: 1 機能 1 ファイル、名前 = ファイル名 = `FeatureName`。`pathPatterns`(`*` = 区切り 1 つの何でも、`@/lib/pathPattern`) / `domains` / `dependsOn` / `when` / `enabled` / `redirectTo`。規則は値を import しない(import type だけ、生成で止める)
- when の値 — 場所: `extensions/whenInputs.ts`(生成物); いつ効くか: 規則の値の評価; やること: 規則の `when` が指したドメインの config.ts の最上位の真偽の export だけを import する(全ドメインの config は読まない)
- 一覧 — 場所: `extensions/rules.ts`（生成物、型 `GeneratedFeatureRule`・`GatedDomain`・`GatedCronTask`・`GatedSettingSection`）; いつ効くか: —; やること: 規則 + 名前 + `dependsOn`(字面の写し、書かない規則は空) + 説明用の表名・汎用 API・設定の節・cron の住所(`tables`・`domainApiPaths`・`settingPaths`・`cronPaths`。`pathPatterns` には足さない)
  - ドメインの表 `domains`(表・汎用 API の住所・持つ機能)・cron の task の表 `cronTasks`(住所・読むドメイン)・設定の節の表 `settingSections`(住所・名指す機能)も出す。読み手は入口(`gate`・`node.ts` の `rules`)を通してこれだけを読む
- ルートゲート — 場所: `src/proxies/featureGate.ts`(`gate.path` を呼ぶ); いつ効くか: リクエストごと; やること: `pathPatterns` に一致するページを `/404`、API を 404 にする
- API の部品工場 — 場所: `src/wiring/apiRoute.ts` が `gate.path` を Factory の口 `gate` に結ぶ; いつ効くか: API のリクエストごと; やること: 閉じた住所の API は Factory も 404(proxy の安全網。`src/lib/routeFactory/README.md`)
- スキーマゲート — 場所: `node/gatedSchema.ts`（`@/featureGate/node` の `gatedSchema`、`pnpm db:push` / `db:push:check`）; いつ効くか: push のとき; やること: 導いた表を push 対象から外す
- 検査 — 場所: `pnpm test src/featureGate scripts/structure/proxies`・`pnpm check extensions`; いつ効くか: CI / 手元; やること: 書き漏れ・書き間違い・常時実行の入口の閉じ漏れ

### 規則の書き方

```ts
// src/featureGate/rules/wallet.ts
import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: ["/wallet", "/api/me/wallet"], // 汎用 API の /api/wallet・/api/walletHistory は書かない(domains から導く)
  domains: ["core/wallet", "core/walletHistory"], // この機能が使うドメインのフォルダ
  defaultEnabled: true, // 入切の上流の既定(必須、true か false)。fork の値は src/config/featureGate/switches.config.ts
};
```

- `pathPatterns` はセグメント境界の前方一致（`/demo` は `/demo-login` を含まない）。`=` を付けると完全一致（`=/mypage` は `/mypage` だけで、fork が `/mypage/<自分のページ>` を足しても巻き込まない）。照合は `src/lib/pathPattern`（門番の判定・ルート地図・pnpm test src/featureGate scripts/structure/proxies が共有）。動的セグメントは書けないので、値が config で決まるなら展開して書く（例: 通貨 slug ごとの `/wallet/<slug>/purchase`）
- **閉じた住所の下の画面・API は一緒に閉じる**（前方一致）。上流の規則の接頭の下に fork が足した画面も閉じる
- `domains` = 規則が閉じるドメインのフォルダ（`src/domains` からの相対で `core/<名前>` か `<名前>`、文字列リテラルの配列）。domains の地区（`src/lib/districtMap` が見つけるドメイン）でない書き方（無いフォルダ・`core/wallet/entities` のような深い場所・`core` そのもの・`_` で始まる雛形）は生成器が止める。表名は書かない: `pnpm generate extensions`（宣言の `derive: "featureTables"`）が地区の下の全 `pgTable` から導く（地区の地図の読み手 `src/lib/districtMap`、字面・コメントの中は見ない）。fork が上流のフォルダに足した表も上流の規則が拾う
  - フォルダの一部の表だけを外す書き方は無い。表を持たないドメイン（Firestore 版の `core/chatRoom` など）も書ける: 表は 0 のまま、汎用 API の住所と依存の検査は表のあるドメインと同じに効く
- **汎用 API の住所（`/api/<domain>`）は書かない**: 生成器が `domains` の各フォルダの `services/server/domainEntry.ts` の `domainEntries` のキーから `/api/<キー>` を導き（字面）、生成一覧の `domains` のそのドメインの `apiPaths` に載せる。住所はドメインに付き、ドメインの開閉で閉じる(下の「ドメインの開閉」。規則の `pathPatterns` には足さない、項目の `domainApiPaths` は説明用)。`domainEntry.ts` の無いフォルダは住所を持たない
  - 手書きと重なると `src/featureGate`・`scripts/structure/proxies` のテスト(/sluice の検査が回す)が知らせる（上流の規則は失敗、fork の規則は表示だけ）。ドメインを足した・キーを変えたら `pnpm generate extensions`（ずれは `pnpm check extensions` が止める）
- **設定の節の住所（`/admin/settings/<key>`）も書かない**: 設定の節（点 `settingSections` の項目、`<ドメイン>/plugs/settingSections/`）に `feature: "<規則名>"`（か配列）を書くと、生成器が節の住所と名指す機能を生成一覧の `settingSections` に載せる（`scripts/structure/extensions/derive/gateSettingPaths.mjs`）。節自身の判定で、**名指す機能が全部開のときだけ開く**(機能の `pathPatterns` には混ぜない、項目の `settingPaths` は説明用)。閉じたときの `rule` は閉じた名指しの機能のうち一覧の順で最初。管理メニューの行は住所の絞り込みで消える。規則名でない `feature` は生成で失敗
- **cron の task の住所（`/api/cron/<name>`）も書かない**: task.ts・task.override.ts がどれかの規則の `domains` のフォルダを値で import すると、生成器が生成一覧の `cronTasks`(住所・読むドメイン)に載せ、読むドメインが全部開のときだけ開く（`scripts/structure/extensions/derive/featureTables.mjs`。項目の `cronPaths` は説明用）。規則に `/api/cron/` を手書きすると生成で失敗
- **上流の既定**: 上流は付け足しの機能を閉じて出荷し、土台の画面は開いたまま。閉 = wallet・payment・coupon・referral・couponAttributionReward・analytics・chatRoom・milestone・deviceFingerprint(子の deviceFingerprintPageIngest は親に従う)・fingerprintChallenge・userAcquisition・userLineProfile・userXProfile・sampleDomain・demoPages・demoLogin・pageEntry・pageServices・interactionTracking・userCounter・phoneVerification・pause・pairedDevice・messagingTracking ほか(依存先に従う子も閉)
  - 開 = signup・pageMypage・利用規約などの法務の画面・withdraw ほか。使う機能は fork が `switches.config.ts` で開ける(`pnpm ops features set <名前> on`)。上流の開発は全開スイッチで全部開ける(「全開スイッチ」)
- **入切の値**: 上流の既定は規則の `defaultEnabled`(必須、`true` か `false` のリテラル。型 `FeatureGateRule` で必須。fork が足す規則も書く)、fork の値は `src/config/featureGate/switches.config.ts`(上流は空 `{}` で出荷し出荷後に書かない、`{ <機能の名前>: true|false }` を並べる、型 `FeatureSwitches`、未知の名前・真偽でない値は読み込みで throw)。自分の値 = (switches の値 ?? `defaultEnabled`) && `enabled`。合成は `ruleList.ts` の 1 か所。ドメインの `config.ts` に入切を置かない(処理の切り替えはドメインの config のまま)
- `enabled` は入切でない開く条件だけ(config の値から導いた値を読む同期関数。例 `bankTransferReview` の「自社振込が選べるか」)。省略 = 条件なし。入切そのもの(プロジェクトが開け閉めする値)を書かない
- `anyOf` = どれか 1 つが開なら開く機能の並び(OR。例 `mypageOther` = 休会か退会)。`dependsOn` と両方あれば両方を満たすとき開
- `when` = ドメインの値の条件の並び(全部 AND、D28): `"<ドメイン>.<名前>"` = そのドメインの config.ts の最上位の `export const <名前>: boolean`(入れ子の鍵・真偽でない値・知らない名前は生成で止める)。例 `bankTransferReview` の `["purchaseRequest.bankTransferInhouseSelectable"]`。指した値の持ち主のドメインが閉じても値は読むだけ(閉じたいなら `dependsOn`)。`enabled()` は環境変数と定数だけ。ドメインの設定値から住所を組み立てず `*` で書く(`payment` の `/wallet/*/purchase`、D23)
- `dependsOn` = この機能が使う機能の名前(規則のファイル名)の並び。下の「機能どうしの依存(dependsOn)」
- `redirectTo` を指定すると 404 の代わりにそこへ rewrite する（例: サインアップ停止中の `/signup-closed`）
- **同じ住所を 2 つの機能に書かない**(URL は 1 つの機能にだけ属する): 親と子が同じ画面を閉じたいときは親から消して子が親に `dependsOn` する(親を閉じれば子も閉じる)。上流に残る組は理由つきの表だけ(`checks/ruleChains.test.ts`)。重なった住所の答え(`rule` と `redirectTo`)は当たった閉じた住所のうち一番細かい一致(同じ細かさはファイル名の順)。上流の規則どうしの行き先の違う重なりは `pnpm test src/featureGate scripts/structure/proxies` で失敗、fork の規則と上流の重なりは表示だけ
- 上流の規則を fork が上書き・無効化する口は無い（fork は閉じる規則を足すだけ）

### 機能どうしの依存(dependsOn)

```ts
// 紹介の報酬はウォレットを使う: ウォレットが閉なら報酬も閉(自分の値が開でも)
export const rule: FeatureGateRule = {
  pathPatterns: ["/mypage/invite/rewards"],
  dependsOn: ["wallet"],
  enabled:  => REWARD_CONFIG.enabled, // 例。省略すれば「自分は開、依存先しだい」
};
```

- 機能が開く = 自分が開 && `dependsOn` の機能が全部開(推移的、全部 AND)。親が閉じれば子・孫も閉じ、その住所・表・汎用 API・設定の節・cron も閉じる(閉じた機能と同じ扱い)
- 書き方: 文字列リテラルの配列(機能の名前を直接書く。型は `FeatureName[]`)。生成器(`pnpm generate extensions`、`scripts/structure/extensions/derive/gateDependsOn.mjs`)が字面で読み、**未知の名前・自分・重複・輪(推移的)・文字列リテラルの配列でない書き方**を規則の名前を出して止める
- 評価は `ruleList.ts` の 1 か所(`resolveFeatureOpen`)。答えの意味:
  - `ruleEnabled(rule)`(門番の口・`rules` の `enabled`): (全開スイッチで開いている || 規則の値) && 依存先が全部開
  - `configEnabled(name)`(`configRules` の `enabled`): 規則の値 && 依存先の規則の値が全部開(スイッチを通さない)
  - `ownEnabled(name)`: 規則の値そのもの = (switches の値 ?? `defaultEnabled` ?? 開) && `enabled`(全開スイッチも依存先も通さない。`pnpm ops features list` の閉の理由)
  - `isOpenedBySwitch(name)`: 全開スイッチがその名前を開けているか(依存先は見ない。開くかは `ruleEnabled`)
- **requires の被覆**(生成で止める。`scripts/structure/extensions/derive/gateRequires.mjs`): 機能 X の `domains` のドメインが `requires`(domainEntry.ts)するドメインは、X の `domains`・X の依存先(推移的)の `domains`・常設(どの機能にも載らないドメイン)のどれかに無ければ止める。直し方は X の `dependsOn` にそのドメインを持つ機能を足す。上流の例外は理由つきの縮む表(今は 0 行)
- **住所の検査**(読み込み後の一覧で、`node/addressCheck.ts` の `checkAddresses`、検査は `pnpm test src/featureGate scripts/structure/proxies`): 同じ住所を 2 つの機能が持つ(手書き・汎用 API・cron・設定の節の全部で)、親の前方一致の下の住所の機能が親に `dependsOn` していない(推移的で可)、を止める。fork の規則も同じ(上流の住所の下に足した規則は上流の機能に `dependsOn`)。依存の根拠が無い入れ子は両方に依存する小さな機能へ。上流の例外は 0(理由つきの縮む表 `ADDRESS_EXCEPTIONS`)
- **組み合わせの検査**(test で止める、`checks/integrity.mjs`、実物は `scripts/structure/proxies/featureGate.test.mjs`): 機能をまたぐ外部キー(ドメインの `requires` と機能の `dependsOn` の両方で覆う。規則の中の外部キーと参照先が常設のものは対象外)・どの機能にも載らないドメイン(常設)の `requires` の先が閉じうる・必須の機能(`required/`)が規則の値で閉、を止める。共有のドメインが別の機能で開いたままは落とさず warn し、`pnpm ops features list` の閉じた機能に出す(`sharedDomainsOpen`)。上流の例外は 0(テスト内の縮む表)
- 全開スイッチの名前指定は依存先を開けない([Internals.md「全開スイッチ(FEATURE_GATE_OPEN)」](./Internals.md#全開スイッチfeature_gate_open))
- `pnpm ops features list` は依存先・依存元(推移的)・閉の理由を出し、`pnpm ops features set` は必須の機能が依存する機能の off を止める(下の節)

### 規則の決まりごと

- **ゲート対象のドメインにルートを足したら、同じ規則の `pathPatterns` に追記する**（表は `domains` のフォルダから自動で入る）。`src/featureGate`・`scripts/structure/proxies` のテスト(/sluice の検査が回す)が次を検査する:
  - 導いた表名が schemaRegistry に実在する（走査の表の集合 = schemaRegistry の全表は `pnpm test scripts/structure/registry/`）
  - **今 `enabled` が false の規則について**、その規則の `domains` のドメイン（表の数は問わない）を import するルート（route.ts / page.tsx と `_screen/` `_components/` 配下）が、その規則の `pathPatterns` で閉じているか、そのファイルの中で規則の名前で門番に聞いている（門番で包む: `gate.enabled("<規則>")`・`gate.required("<規則>")`・`useGate().enabled("<規則>")`・`const g = useGate()` の `g.enabled("<規則>")`、名前は文字列のリテラル。判定 `checks/routeImports.mjs`。`domains` の無い規則は対象外）
  - 同じく、そのドメインの汎用 CRUD（`/api/<domain>`）が閉じている
  - 現在のフラグで、外す表を残す表が外部キーで参照していない
  - 常時実行の入口の閉じ漏れ（下）
- **有効な機能のルートは検査しない。** 開いていて正しいので、その機能を土台にした fork は何も宣言しなくてよい。機能を切ると、その機能に依存するルートと外部キーがテストで一覧になる（= 切る前に直す場所）
- **`FEATURE_GATE_CHECK=all pnpm test src/featureGate scripts/structure/proxies` は upstream も fork も実行する。** 段階 ship の `pnpm check proxies`(`scripts/structure/proxies/testGate.mjs`)が毎回回し(段階 build では回さない: build はテストを回さない。Vercel の build には .git が無い)、落ちたら止める(全 Tier。違反と環境の依存の不足 = DB・Firebase の未設定・モジュールが見つからない、は見出しを分けて出す。どちらも止める)
  - 全規則を無効とみなし、全機能 false でスキーマゲートが成立することも検査する(fork が `required/` で必須と宣言した機能とその dependsOn の先は、`pnpm ops features set` が閉じないので開いたまま扱う)。閉じないルートの例外の表は無い(上流も fork も、ルートのファイルの中で門番に聞く。D54)
- **サンプルのドメイン**（`sampleDomain`、規則の `defaultEnabled: false`）: 上流の既定 閉（上流の開発は全開スイッチで開ける。fork が見るなら開ける）
  - 権限は公開読み・ログイン済みの更新・子の画像のログイン済みアップロードのままで厳しくしない → **実際の利用者がいる fork は閉じる**(`pnpm ops features set sampleDomain off` = `src/config/featureGate/switches.config.ts` に `sampleDomain: false`): 管理画面・`/api/sample*` の汎用 API・サンプルを読むデモ画面 4 つ(`demoSampleDomain`)が 404、5 表（samples ほか）は db:push で作らない（既存の表と行は消さない）。管理のメニューの行は残る
- **機能どうしの前提**: payment は wallet を前提にする（`purchase_requests` → `wallet_histories` の外部キー。push 時に例外になる）。referral は coupon を前提にする（招待コードの実体はクーポン。テストで検査）
