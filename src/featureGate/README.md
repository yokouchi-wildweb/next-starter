# src/featureGate — 門番(機能を閉じる仕組み)

## Overview

機能(プロジェクトが開け閉めする単位、規則 1 本)を閉じると、その住所と、どの開いている機能にも挙げられていないドメインの表・汎用 API・cron を閉じる仕組み。fork が upstream の機能を「削除せず使わないまま残す」ための土台。

src 直下の専用の基盤に置く(lib にも core のドメインにも置かない)。src 直下の基盤に置いてよいのは、ドメインの集合を横断する仕組みだけ(今は featureGate・registry・wiring)。maintenance・demoMode・cron のタスクなど、仕組みに従う側は置かない。

### 言葉

- **住所**: 機能が閉じる URL の型(`pathPatterns`。前方一致、`=` 付きは完全一致)
- **常時実行の入口**: どのページからも読まれる結線(provider・登録表など)。閉じた機能の物を自分で外す
- **ドメイン**(domain): 業務か仕組みの概念の部品。表・サービス・画面の部品の持ち主(今は `src/domains/<d>/`)。**開閉の概念を持たない**: 開いた機能のどれかが規則の `domains` に持てば開、どの機能にも載らないドメインは基盤として常に開
- **機能**(feature): プロジェクトが開け閉めする単位 = 規則 1 本(`rules/<名前>.ts`、名前 = `FeatureName`)。使うドメイン(`domains`)・自分の住所(`pathPatterns`)・依存する機能(`dependsOn` / `anyOf`)・自分のスイッチ(`defaultEnabled` と fork の `switches.config.ts`)を持つ
- **門番**(featureGate): 機能の開閉を評価し、住所・表・汎用 API・cron・設定の節・リンクに及ぼす基盤(このフォルダ)。名前(`featureGate`・`FeatureName`・`gate` / `useGate`・設定の節の `feature:`・`pnpm ops features list / set`・`rules/`)はもとから機能の意味

### 置き場

| 置き場 | 持ち主 | 中身 |
|---|---|---|
| `rules/<名前>.ts` | 上流・fork(受け口) | 機能を閉じる規則(1 機能 1 ファイル、`export const rule`)。名前 = ファイル名 = `FeatureName` |
| `alwaysOnExceptions/<名前>.ts` | fork(受け口、上流の項目は 0) | 常時実行の入口の例外(`export const exception` か `export const registry`) |
| `dependencyExceptions/<名前>.ts` | fork(受け口、上流の項目は 0) | 依存の検査の例外(`export const exception: DependencyException`) |
| `required/<機能名>.ts` | fork(受け口) | この fork が必ず使う機能(`export const required: RequiredFeature`)。依存の検査はこの機能のフォルダを外から読むことを通す。`pnpm ops features set <名前> off` はこの機能(と必須の機能が依存する機能)を止め、`list` は「必須」と出す |
| `extensionPoints.ts` | 上流 | 受け口の宣言(`rules`・`alwaysOnExceptions`・`alwaysOnRegistries`・`dependencyExceptions`・`required`) |
| `extensions/` | 生成物 | `pnpm generate extensions` が書く一覧(手で編集しない)。`rules.ts` は名前の union `FeatureName` も出す |
| `index.ts` | 上流 | 入口(server・proxy): `gate`・配線用の `clientGateState` と型 |
| `client.ts` | 上流 | 入口(client): `useGate`・`GatedLink`・配線用の `GateProvider` と型 |
| `node.ts` | 上流 | 入口(道具: scripts とテストだけ): `rules`(全開スイッチを通した一覧)・`configRules` / `configEnabled` / `configPath`(規則の値だけ)・`isOpenedBySwitch`・`gatedSchema`・`closedTables`・例外の一覧 |
| `ruleList.ts`・`openSwitch.ts` | 上流 | 判定の入口(生成一覧を全開スイッチと依存先(dependsOn)で包む。門番の中で生成一覧を値で読み、規則の `enabled` を直に呼ぶのはここだけ)と全開スイッチ(`Internals.md`「全開スイッチ」) |
| `types.ts`・`evaluate.ts`・`hiddenHref.ts`・`area.ts`・`clientState.ts`・`tools/server/`・`tools/client/`・`node/` | 上流 | 型・判定の中身(外に出さない。`hiddenHref.ts` = 隠す判定・`area.ts` = 枠の判定の純関数で server と client が共有、`clientState.ts` = client に渡す値の計算)・1 道具 1 ファイルと束・道具の中身 |
| `checks/` | 上流 | 検査(`pnpm test src/featureGate scripts/structure/proxies`。`FEATURE_GATE_CHECK=all` で全部閉じる検査) |

## Usage

### 規則の例 4 つ

```ts
// 1. 単体のドメインの機能: 1 つのドメインと、その画面・API
export const rule: FeatureGateRule = {
  pathPatterns: ["/admin/milestones", "/api/me/milestones"],
  domains: ["core/milestone"],
  defaultEnabled: false,
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
  defaultEnabled: true,
};

// 4. fork が上流の機能の住所の一部を閉じる機能: 上流の住所の下に住所を持つので上流の機能に dependsOn する(住所の検査が求める)
// src/featureGate/rules/friendCouponAdmin.ts(fork の名前)
export const rule: FeatureGateRule = {
  dependsOn: ["coupon"],
  pathPatterns: ["/admin/coupons/friend-coupon"],
  defaultEnabled: false,
};
```

- 依存の根拠の無い入れ子(親の住所の下にあるが、子の機能は親に依存しない)は、親と子の両方に依存する小さな機能に住所を持たせる(`enabled` を書かず `defaultEnabled: true` = 両方が開のとき開。例 `demoSampleDomain`・`walletAnalytics`・`mypageInvite`)

### fork での使い方

- upstream の機能を使わない: その機能のフラグを false にする。ルートは 404、テーブルは作られない。コードは削除しない
- upstream の画面を使わない: 画面を消したり `_` 付きに rename したりせず（所有の検査で違反、src/lib/forkOwnership/README.md）、その画面の機能(`pageMypage`・`pageEntry`・`pageServices`・`pageTerms` ほか規約 3 種・`adminDemoUsers` など)を `pnpm ops features set <名前> off` で閉じる(`src/config/featureGate/switches.config.ts` に書かれる)。止めたページはルート地図に `gated-off(<pattern>)` と載る。置き換えたいときは止めずに 1 行スイッチで `_components/` の Screen へ向ける
  - マイページのアカウントの項目(メール・パスワード・プロフィール・電話番号)は機能でなく user の設定 `account.editableItems` で選ぶ(`src/domains/core/user/Extension.md`)。チャットの管理画面は親の機能(`chatRoom`)の住所で子のスイッチは無い。機能は使い管理画面だけを閉じたい fork は、その住所だけを持つ自前の規則(`defaultEnabled: false`)を足す(上流の住所と重なるのは表示だけで止まらない)。ユーザータグは規則を持たない常時開の基盤
- スイッチの無い upstream の画面を止めたい: upstream に依頼する（`/order <親>`）。fork の規則で upstream の画面を止めない（upstream の規則と重なり、merge のたびに見直しになる）
- 新しいドメインを機能として閉じられるようにする: ドメインを作り(`pnpm forge`)、`rules/<機能の名前>.ts` に規則を手で書いて `domains` にそのドメインのフォルダを入れる(管理画面の住所は `pathPatterns`、入切の既定は `defaultEnabled`)→ `pnpm generate extensions`。汎用 API・表・cron は導出に任せる。domain.json の `closable`(閉じられる形の印)と 1 対 1 のひな形はなくした(書くと生成器が案内して止める)。どの機能にも載らないドメインは基盤として常に開
- fork 自身の機能を閉じたい: `rules/<名前>.ts`(上流の規則と違う名前)に規則を 1 つ置き、`pnpm generate extensions`。upstream の機能と一緒に開閉させるなら `dependsOn` に upstream の機能を書く（例: `dependsOn: ["payment"]`）。入切の既定は `defaultEnabled`、値を変えるのは `switches.config.ts`
- 機能を切ったら `pnpm test src/featureGate scripts/structure/proxies` が列挙するルート・表・入口を、規則に入れるか、呼び出し側でフラグを見る
- ウォレットと購入を外す(規則 `wallet` と `payment` を閉じる): core を編集しなくてよい。画面・汎用 API・自前の API・webhook・cron(`wallet-*`・`expire-pending-purchases`)の住所が閉じ、常時実行の項目(一括調整のジョブ・退会の後片付け・コイン発行の源)が止まり、管理メニューの行と利用者の管理一覧の残高調整・coupon の購入割引のカテゴリが消える(`scripts/structure/proxies/walletOff.test.tsx`、`pnpm test src/featureGate/checks scripts/structure/proxies/walletOff.test.tsx`)

### pnpm ops features list / pnpm ops features set

道具は門番の `node.ts`（`readFeatureReport`・`planFeatureSet`、`node/describe.ts`・`node/setEnabled.ts`）。scripts はそれを呼ぶだけ（`scripts/operations/features/`）。

- `pnpm ops features list [--name <規則名>] [--json]`: 規則ごとに開閉(規則の値 = switches ?? 既定 && 条件)・必須（`required/`）・住所（手書き / 汎用 API の導出 / 設定の節の導出）・機能のフォルダ・表・依存（閉じられるフォルダを外から値で読むファイルと、許された形。依存の検査の走査そのもの。許されていない依存は「未」と出る）・名前の呼び出し箇所（`gate.enabled` / `gate.assert` / `useGate.enabled` の字面の `"<名前>"`
  - 変数で渡す名前は見えない）・機能どうしの依存(依存先 `dependsOn` とその推移 `dependsOnAll`・どれか `anyOf`・依存元(推移的)`dependedOnBy`・閉の理由 `closedBy` = 自分の値 / 閉じた依存先の名前。表の開閉は「閉(依存先 <名前> が閉)」と出す)・全開スイッチの名前指定の足りない名前(`switchMissing`)。どれも `--json` に載る(依存のファイルの欄 `dependents` とは別)。読むだけ
- `pnpm ops features set <規則名> on|off`: 書き先は Tier で決まる: fork = `src/config/featureGate/switches.config.ts` の `export default { … }` の直下の `<名前>: true|false`、Tier1 = 規則のファイルの `defaultEnabled`(どちらも無ければ足す。値はいつも `true|false` を書き、既定と同じでも消さない)。リテラルでない値などは何も書かず理由を出して exit 2(手で直す)。必須の機能を off にしようとすると何も書かずに exit 1。必須の機能が `dependsOn` で推移的に依存する機能の off も何も書かずに exit 1(必須の機能からの依存の連鎖を出す)
  - on にした機能の依存先が規則の値で閉なら、値は書いた上で「依存先 <名前> が閉なので閉のまま」と出す
- `pnpm ops features set` は `db:push`・`pnpm generate extensions` を打たない（表を持つ機能を開けたら `pnpm db:push` は人が打つ）

## API

入口・規則の書き方・依存は `API.md`(この README の API を分けた文書)。

## Internals

閉じる範囲(表・汎用 API・cron・常時実行の入口)・検査・全開スイッチ・守りは `Internals.md`(この README の Internals を分けた文書)。
