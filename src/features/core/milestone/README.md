# milestone（マイルストーンフレームワーク）

ユーザーが特定の条件を達成したことを検知・記録し、達成時に任意の処理を実行する汎用フレームワーク。

ベースリポジトリでは**仕組みのみ**提供する。具体的なマイルストーン定義は下流プロジェクトで実装する。

閉じられる機能(門番の規則 `src/featureGate/rules/milestone.ts`、今は常に開)。閉じたときの統合ポイント: 決済の完了は評価せず結果は空・本登録の後(user_registered)は何もしない・購入完了の画面は達成の表示を描かない。新しい統合ポイントも `gate.enabled("milestone")` を確かめてから `evaluateMilestones` を呼ぶ。

---

## 仕組み

```
イベント発生（購入完了など）
  ↓
evaluateMilestones(trigger, { userId, payload }, tx?)
  ↓
登録済みマイルストーンのうち、該当 trigger を持つものをループ
  ↓ 各マイルストーンについて:
  ① milestones テーブルで達成済みか確認 → 済みならスキップ
  ② evaluate(context, tx?) で条件を評価 → false ならスキップ
  ③ onAchieved() を実行（報酬付与など）
  ④ milestones に記録（user_id + milestone_key のユニーク制約で冪等性を保証）
```

---

## ファイル構成

```
milestone/
├── types/milestone.ts              # 型定義（MilestoneDefinition, PersistedMilestoneResult 等）
├── constants/triggers.ts            # ベースが提供するトリガー名定数
├── services/server/
│   ├── milestoneRegistry.ts         # getMilestonesByTrigger など（一覧の読み手）
│   ├── wrappers/
│   │   └── evaluateMilestones.ts    # 評価エンジン（コア処理）
│   └── definitions/
│       └── index.ts                 # 下流が副作用インポートを追加する場所
├── components/
│   ├── MilestoneNotifications.tsx   # 達成通知リスト表示コンポーネント
│   ├── DefaultMilestoneNotification.tsx # 未登録キーの汎用通知
│   └── renderers/
│       └── <名前>.tsx  # 下流のレンダラーの項目(export const renderer)
├── entities/                        # 生成ファイル（milestones テーブル定義）
└── hooks/                           # 生成ファイル（クライアント用フック）
```

---

## 使い方（下流プロジェクト）

### 1. マイルストーン定義ファイルを作成

`services/server/definitions/<名前>.ts` を作成し、`pnpm generate extensions` で一覧に入れる。

```ts
// services/server/definitions/firstPurchase.ts

import type { MilestoneDefinition } from "@/features/core/milestone/types/milestone";
import { purchaseRequestService } from "@/features/core/purchaseRequest/services/server/purchaseRequestService";

export const milestone: MilestoneDefinition = {
  key: "first_purchase",
  triggers: ["purchase_completed"],

  // 条件: 完了済み購入が1件（= 今回が初回）
  // 第2引数の tx でトランザクション内の最新状態を参照可能
  evaluate: async ({ userId }, tx) => {
    const { results } = await purchaseRequestService.search({
      where: {
        and: [
          { field: "user_id", op: "eq", value: userId },
          { field: "status", op: "eq", value: "completed" },
        ],
      },
      limit: 1,
      page: 1,
    });
    return results.length === 1;
  },

  // 達成時: 紹介報酬をトリガー
  onAchieved: async ({ userId, tx }) => {
    // 例: referralReward と連携
    // const referral = await referralService.findByInvitee(userId, tx);
    // if (referral) await triggerRewards("first_purchase", referral, {}, tx);
    return { note: "初回購入達成" };
  },
};
```

### 2. 一覧を作る

`pnpm generate extensions`（`extensions/definitions.ts` に入る）。

これだけで `evaluateMilestones()` 呼び出し時に自動的に評価される。

---

## evaluate で使えるコンテキスト

`evaluate` と `onAchieved` には `MilestoneEventContext` が渡される。

```ts
type MilestoneEventContext = {
  userId: string;                       // 対象ユーザーID
  trigger: string;                      // トリガー名
  payload: Record<string, unknown>;     // イベント固有データ
};
```

`payload` の内容はトリガーごとに異なる。各統合ポイントで何が渡されるかは後述の「統合ポイント一覧」を参照。

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

---

## 統合ポイント一覧

ベースリポジトリが提供する `evaluateMilestones()` の呼び出し箇所。

### `purchase_completed`

- **場所**: `purchaseRequest/services/server/wrappers/purchaseService.ts` の `completePurchase()` 内
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

### `user_registered`

- **場所**: `auth/services/server/registration.ts` の `register()` の後段（`postRegistrationMilestones.ts` の `runPostRegistrationMilestones`）
- **タイミング**: 本登録の守り（ID トークンの検証・メール一致・仮登録の確認）→ `registerFromAuth`（active 化）→ プロフィール・流入経路・招待コードの後、セッション発行の前に 1 回。登録の守りより前には発火しない
- **トランザクション**: 登録とは別の 1 つの tx を開いて評価する（このトリガーの定義が無ければ開かない）。`onAchieved` に渡る `tx` で付与すれば、付与と `milestones` の記録が同時に確定する（同じ人の同時の 2 回目は記録のユニークで落ち、付与も巻き戻る）
- **1 人 1 回**: `milestones` の `user_id + milestone_key` のユニーク。退会後の再登録など同じ `users.id` の 2 度目の本登録では、発火しても達成済みで走らない
- **失敗時**: 定義ごとの失敗は SAVEPOINT で分離（他の定義は確定する）。評価そのもの・tx の失敗はログだけで、**登録は止めない**（登録は確定済みで巻き戻さない。巻き戻したい処理はここに置かない）
- **結果の伝達**: 応答には載せない（`purchase_completed` の `milestone_results` のような永続化は無い）
- **payload**（`UserRegisteredPayload`）:
  - `user`: 本登録後の利用者（User 型）
  - `role`: 本登録のロール
  - `providerType`: 認証手段（`"email"` など）
  - `inviteCode`: 招待コードの適用結果（`{ applied: true }` / `{ applied: false, reason }` / `null` = 指定なし）

登録ボーナスのレシピ（金額は管理画面で変えられる setting の項目、付与は定義 1 つ）:

```ts
// 1. src/features/core/setting/fields/signupBonusCoinAmount.ts（setting の項目の受け口。書式は setting README）
// 2. src/features/core/milestone/services/server/definitions/signupBonus.ts → pnpm generate extensions
import { gate } from "@/featureGate";
import type { MilestoneDefinition } from "@/features/core/milestone/types/milestone";
import { settingService } from "@/features/core/setting/services/server/settingService";
import { walletService } from "@/features/core/wallet/services/server/walletService";

export const milestone: MilestoneDefinition = {
  key: "signup_bonus",
  triggers: ["user_registered"],
  evaluate: async () => {
    if (!gate.enabled("wallet")) return false; // wallet を閉じている間は表が無い
    const setting = await settingService.getGlobalSetting();
    return (setting.signupBonusCoinAmount ?? 0) > 0;
  },
  onAchieved: async ({ userId, tx }) => {
    const setting = await settingService.getGlobalSetting();
    const amount = setting.signupBonusCoinAmount ?? 0;
    // tx を渡す: 付与と達成の記録が同時に確定する（二重付与しない）
    await walletService.adjustBalance(
      {
        userId,
        walletType: "regular_coin",
        changeMethod: "INCREMENT",
        amount,
        sourceType: "system",
        reason: "新規登録ボーナス",
        // 付与の種類（walletHistory/reasonKeys/signupBonus.ts に { key: "signup_bonus", label: "登録ボーナス", category: "bonus" }）。
        // 区分（bonus）は種類から決まる。wallet README「付与の種類」
        reasonKey: "signup_bonus",
      },
      tx,
    );
    return { amount };
  },
};
```

---

## 独自トリガーの追加（下流プロジェクト）

ベースが提供する統合ポイント以外にも、下流プロジェクトで独自にトリガーを追加できる。

### 手順

1. トリガー名の定数を定義（任意の場所）

```ts
export const MILESTONE_TRIGGER_USER_VERIFIED = "user_verified";
```

2. 適切な場所で `evaluateMilestones()` を呼び出す

```ts
import { evaluateMilestones } from "@/features/core/milestone/services/server/wrappers/evaluateMilestones";

// 本人確認完了後
await evaluateMilestones("user_verified", {
  userId,
  payload: { verifiedAt: new Date() },
});
```

3. そのトリガーに反応するマイルストーンを定義

```ts
export const milestone: MilestoneDefinition = {
  key: "identity_verified",
  triggers: ["user_verified"],
  evaluate: async () => true,  // トリガー発生 = 即達成
  onAchieved: async ({ userId }) => {
    // 報酬付与など
  },
};
```

---

## クライアント側のレンダラーシステム

サーバー側の定義(`definitions/`)と対称的に、クライアント側でマイルストーン達成時のUI通知を登録できる仕組み。

### 仕組み

```
completePurchase() で milestone_results を jsonb に保存
  ↓
/api/wallet/purchase/[id]/status のレスポンスに milestoneResults を含める
  ↓
PurchaseComplete コンポーネントが MilestoneNotifications を描画
  ↓
各マイルストーンについて:
  ① レンダラーレジストリから該当キーのレンダラーを検索
  ② displayMode で分離:
     - inline（デフォルト）→ リスト内にインライン表示
     - modal → リストから除外し、別途モーダルとして描画
  ③ 登録済み → そのコンポーネントで描画
  ④ 未登録 → DefaultMilestoneNotification（汎用通知）で描画
```

### 永続化型

`PersistedMilestoneResult` は `evaluateMilestones` の結果を jsonb にシリアライズするための型。

```ts
type PersistedMilestoneResult = {
  milestoneKey: string;        // マイルストーンキー
  achieved: boolean;           // 達成したかどうか（保存されるのは true のみ）
  metadata?: Record<string, unknown>; // onAchieved の戻り値
};
```

### レンダラーの登録（下流プロジェクト）

#### 1. レンダラーコンポーネントを作成

```tsx
// src/features/myDomain/components/FirstPurchaseCelebration.tsx

"use client";

import type { MilestoneRendererProps } from "@/features/core/milestone/types/milestoneRenderer";

export function FirstPurchaseCelebration({ result }: MilestoneRendererProps) {
  const bonus = result.metadata?.reward as string | undefined;
  return (
    <div>
      <p>初回購入おめでとうございます！</p>
      {bonus && <p>ボーナス: {bonus}</p>}
    </div>
  );
}
```

#### 2. 受け口に項目を置く

```ts
// components/renderers/firstPurchase.ts

import type { MilestoneRendererDefinition } from "@/features/core/milestone/types/milestoneRenderer";
import { FirstPurchaseCelebration } from "@/features/myDomain/components/FirstPurchaseCelebration";

export const renderer: MilestoneRendererDefinition = {
  key: "first_purchase",          // マイルストーン定義の key と一致させる(同じ key は読み込み時に例外)
  component: FirstPurchaseCelebration,
  priority: 10,                   // 小さいほど先に表示（デフォルト: 0）
  // displayMode: "modal",        // モーダル表示にする場合
};
```

→ `pnpm generate extensions`。受け口に置くのは項目だけ(部品は責務のドメインへ)。

これだけで `PurchaseComplete` ページにマイルストーン達成通知が自動的に表示される。

### 表示モード（displayMode）

レンダラー登録時に `displayMode` を指定して表示方法を切り替えられる。

| モード | 動作 | ユースケース |
|---|---|---|
| `inline`（デフォルト） | リスト内にインライン表示 | 一般的な達成通知 |
| `modal` | リストから除外し、モーダルとして描画 | ランクアップ演出、初回購入の特別演出 |

モーダル型のレンダラーコンポーネントは、自身でモーダルUIの表示/非表示を管理する。

```ts
export const renderer: MilestoneRendererDefinition = {
  key: "rank_up",
  component: RankUpModal,       // モーダルUI込みのコンポーネント
  displayMode: "modal",
  priority: 100,
};
```

---

## 設計上の注意点

- **冪等性**: `user_id + milestone_key` のユニーク制約で、同じマイルストーンが二重に記録されることはない
- **エラー分離**: 個別マイルストーンの evaluate/onAchieved でエラーが発生しても、他のマイルストーンの評価は継続する。tx がある場合は PostgreSQL の SAVEPOINT で分離されるため、DB エラーがトランザクション全体を汚染しない
- **トランザクション**: `completePurchase` から呼ばれる場合は既存の tx が渡される。マイルストーンの記録と購入処理が同一トランザクションで実行される。evaluate にも tx が渡されるため、トランザクション内の最新状態を参照可能
- **パフォーマンス**: 登録マイルストーンが0件の場合、`evaluateMilestones` は即座に空配列を返す（オーバーヘッドなし）
- **user_id に FK なし**: ユーザー削除後も達成記録は保持される

---

## referralReward との関係

| | referralReward | milestone |
|---|---|---|
| 用途 | 紹介関係に基づく報酬配布 | 任意の条件達成の検知・記録 |
| トリガー | 明示的に `triggerRewards()` を呼ぶ | イベント発生時に自動評価 |
| 条件判定 | トリガー名でマッチ（条件なし） | `evaluate()` で動的に判定 |
| 冪等性 | `referral_id + reward_key` | `user_id + milestone_key` |

マイルストーンの `onAchieved` 内から `triggerRewards()` を呼ぶことで連携可能。
