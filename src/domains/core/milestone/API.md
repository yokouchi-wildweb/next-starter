# milestone — API

## Overview

- milestone の API(定義の欄・評価のコンテキスト・統合ポイントの payload・結果の型・レンダラーの props)の参照。概要と使い方は `README.md`

## API

### シリーズの欄(`MilestoneSeries`)

- 受け口の型は `MilestoneItem` = `MilestoneDefinition | MilestoneSeries`。`defineMilestoneSeries` は段階の型 `S` を推すための恒等関数(`export const milestone: MilestoneItem = …` と書いてもよい)
- 読み手(`milestoneRegistry`)が評価のたびに `stages()` を読み、段階ごとの定義へ展開する(`getMilestonesByTrigger` / `getMilestoneByKey` / `getAllMilestones` の戻りは展開後の `MilestoneDefinition`、段階のものは `series` の印付き)

| 欄 | 型 | 意味 |
| --- | --- | --- |
| `kind` | `"series"` | シリーズの印(普通の定義には書かない) |
| `key` | `string` | シリーズの鍵(他のマイルストーン・段階の鍵と重ならない。達成の記録には使わない) |
| `triggers` | `string[]` | 評価するイベント(段階のすべてに共通) |
| `order` | `"sequential" \| "unordered"` | 段階どうしの順(ランク = sequential、解放の一覧 = unordered) |
| `stages` | `() => readonly S[]` | 段階の一覧。評価のたびに呼ぶ(config・setting から読める)。並びがその時の評価の順 |
| `stageKey` | `(stage: S) => string` | 段階 → 達成の鍵(`milestones.milestone_key` に記録される) |
| `evaluate` | `(stage, context, tx?) => Promise<boolean>` | 段階の達成条件 |
| `onAchieved?` | `(stage, params) => Promise<Record<string, unknown> \| void>` | 段階の達成時(付与・通知)。戻り値は metadata |
| 展開後の `series` | `{ seriesKey, stageKey, index, order }` | 読み手が段階の定義に付ける印(項目には書かない) |

### シリーズの進み具合(server)

`getMilestoneSeriesProgress(userId, seriesKey, tx?)`(`services/server/wrappers/getMilestoneSeriesProgress.ts`)は今の `stages()` と記録から返す。シリーズが無ければ `null`。

| 欄 | 意味 |
| --- | --- |
| `stages` | `[{ stageKey, index, achieved, achievedAt }]`(今の並び。消した段階の記録は出ない) |
| `achievedKeys` | 達成済みの段階の鍵(並び順。sequential なら最後が今の段) |
| `next` | 次の段階の鍵(未達成の一番下 / 最初)。全部済みなら `null` |
| `remaining` | 未達成の段階の数 |
| `seriesKey` / `order` | シリーズの鍵と順 |

数の残り(次の段まであと何円など)は段階ごとに意味が違うので持たない(段階の値から項目の側で計算する)。client から出すときは自分の route / loader から呼ぶ(上流は hook と API を持たない)。テスト: `pnpm test src/domains/core/milestone/services/server/wrappers/getMilestoneSeriesProgress.test.ts`

### evaluate で使えるコンテキスト

`evaluate` と `onAchieved` には `MilestoneEventContext` が渡される。

```ts
type MilestoneEventContext = {
  userId: string;                       // 対象ユーザーID
  trigger: string;                      // トリガー名
  payload: Record<string, unknown>;     // イベント固有データ
};
```

`payload` の内容はトリガーごとに異なる。各統合ポイントで何が渡されるかは下の「統合ポイント」を参照。

`evaluate` には第2引数として `tx?: TransactionClient` も渡される。トランザクション内の最新状態を参照したい場合に使用する。

```ts
// tx を使ったクエリ例（トランザクション内の未コミットデータも参照可能）
evaluate: async ({ userId }, tx) => {
  const executor = tx ?? db;
  const rows = await executor.select().from(SomeTable).where(...);
  return rows.length > 0;
},
```

`payload` のデータを使うことも、サービスを直接呼び出して追加データを取得することもできる。

### 統合ポイント

上流が持つ `evaluateMilestones()` の呼び出し箇所。

#### `purchase_completed`

- **場所**: `purchaseRequest/services/server/wrappers/completePurchase.ts` の `completePurchase()` 内
- **タイミング**: 決済完了 → ウォレット残高更新後（同一トランザクション内）
- **結果の永続化**: 達成されたマイルストーンは `purchase_requests.milestone_results` (jsonb) に自動保存される
- **クライアントへの伝達**: `/api/wallet/purchase/[id]/status` のレスポンスに `milestoneResults` として含まれる
- **payload**:
  - `purchaseRequest`: 完了した購入リクエスト（PurchaseRequest 型）
  - `walletHistoryId`: 作成されたウォレット履歴ID

```ts
// payload の使用例
evaluate: async ({ userId, payload }, tx) => {
  const pr = payload.purchaseRequest as PurchaseRequest;
  return pr.payment_amount >= 10000;
},
```

#### `user_registered`

- **場所**: `auth/services/server/registration.ts` の `register()` の後段（`postRegistrationMilestones.ts` の `runPostRegistrationMilestones`）
- **タイミング**: 本登録の守り（ID トークンの検証・メール一致・仮登録の確認）→ `registerFromAuth`（active 化）→ プロフィール・流入経路・招待コードの後、セッション発行の前に 1 回。登録の守りより前には発火しない
- **トランザクション**: 登録とは別の 1 つの tx を開いて評価する（このトリガーの定義が無ければ開かない）。`onAchieved` に渡る `tx` で付与すれば、付与と `milestones` の記録が同時に確定する（同じ人の同時の 2 回目は記録のユニークで落ち、付与も巻き戻る）
- **1 人 1 回**: `milestones` の `user_id + milestone_key` のユニーク。退会後の再登録など同じ `users.id` の 2 度目の本登録では、発火しても達成済みで走らない
- **失敗時**: 定義ごとの失敗は SAVEPOINT で分離（他の定義は確定する）。評価そのもの・tx の失敗はログだけで、**登録は止めない**（登録は確定済みで巻き戻さない）
- **結果の伝達**: 応答には載せない（`purchase_completed` の `milestone_results` のような永続化は無い）
- **payload**（`UserRegisteredPayload`）:
  - `user`: 本登録後の利用者（User 型）
  - `role`: 本登録のロール
  - `providerType`: 認証手段（`"email"` など）
  - `inviteCode`: 招待コードの適用結果（`{ applied: true }` / `{ applied: false, reason }` / `null` = 指定なし）

### 結果の型(`PersistedMilestoneResult`)

`PersistedMilestoneResult` は `evaluateMilestones` の結果を jsonb にシリアライズするための型。

```ts
type PersistedMilestoneResult = {
  milestoneKey: string;        // マイルストーンキー
  achieved: boolean;           // 達成したかどうか（保存されるのは true のみ）
  metadata?: Record<string, unknown>; // onAchieved の戻り値
  seriesKey?: string;          // シリーズの段階のとき: シリーズの鍵
  stageKey?: string;           // シリーズの段階のとき: 段階の鍵(= milestoneKey)
};
```

`evaluateMilestones` の結果(`MilestoneEvaluationResult`)も段階のときは `series: { seriesKey, stageKey }` を持つ。`completePurchase` は保存する結果にこの 2 つを写す(普通の定義の結果は series を持たない)。

### レンダラー

- `MilestoneRendererDefinition`: `key`(マイルストーン定義の key、またはシリーズの鍵)・`component`・`priority`(小さいほど先、既定 0)・`displayMode`
- シリーズの鍵のレンダラーは、そのシリーズの段の結果を 1 つにまとめて描く(1 回の購入でランクを 2 つ越えても通知は 1 つ)。`MilestoneNotifications` は段階の鍵 → シリーズの鍵の順で引き、段階の鍵の項目が勝つ(その段だけ別の演出にできる)

| props | シリーズの鍵のレンダラー | 段階の鍵・普通の定義の鍵のレンダラー |
| --- | --- | --- |
| `result` | その評価で達成した段のうち一番上の段 | その結果 |
| `seriesResults` | その評価で達成した段の結果の全部(下から = 評価の順) | `undefined` |

レンダラーの無い段は 1 件ずつ既定の通知。テスト: `pnpm test src/domains/core/milestone/components/MilestoneNotifications.render.test.tsx`

#### 表示モード(`displayMode`)

| モード | 動作 | ユースケース |
|---|---|---|
| `inline`（デフォルト） | リスト内にインライン表示 | 一般的な達成通知 |
| `modal` | リストから除外し、モーダルとして描画 | ランクアップ演出、初回購入の特別演出 |

モーダル型のレンダラーコンポーネントは、自身でモーダルUIの表示/非表示を管理する。
