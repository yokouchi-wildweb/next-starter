# milestone（マイルストーンフレームワーク）

ユーザーが特定の条件を達成したことを検知・記録し、達成時に任意の処理を実行する汎用フレームワーク。

ベースリポジトリでは**仕組みのみ**提供する。具体的なマイルストーン定義は下流プロジェクトで実装する。

---

## 仕組み

```
イベント発生（購入完了など）
  ↓
evaluateMilestones(trigger, { userId, payload }, tx?)
  ↓
登録済みマイルストーンのうち、該当 trigger を持つものをループ
  ↓ 各マイルストーンについて:
  ① user_milestones テーブルで達成済みか確認 → 済みならスキップ
  ② evaluate(context, tx?) で条件を評価 → false ならスキップ
  ③ onAchieved() を実行（報酬付与など）
  ④ user_milestones に記録（user_id + milestone_key のユニーク制約で冪等性を保証）
```

---

## ファイル構成

```
milestone/
├── types/milestone.ts              # 型定義（MilestoneDefinition, MilestoneEventContext 等）
├── constants/triggers.ts            # ベースが提供するトリガー名定数
├── services/server/
│   ├── milestoneRegistry.ts         # registerMilestone / getMilestonesByTrigger
│   ├── wrappers/
│   │   └── evaluateMilestones.ts    # 評価エンジン（コア処理）
│   └── definitions/
│       └── index.ts                 # 下流が副作用インポートを追加する場所
├── entities/                        # 生成ファイル（user_milestones テーブル定義）
└── hooks/                           # 生成ファイル（クライアント用フック）
```

---

## 使い方（下流プロジェクト）

### 1. マイルストーン定義ファイルを作成

`services/server/definitions/` 配下にファイルを作成する。

```ts
// services/server/definitions/firstPurchase.ts

import { registerMilestone } from "../milestoneRegistry";
import { purchaseRequestService } from "@/features/core/purchaseRequest/services/server/purchaseRequestService";

registerMilestone({
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
});
```

### 2. definitions/index.ts に副作用インポートを追加

```ts
// services/server/definitions/index.ts

import "./firstPurchase";
import "./totalSpent10000";
```

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
registerMilestone({
  key: "identity_verified",
  triggers: ["user_verified"],
  evaluate: async () => true,  // トリガー発生 = 即達成
  onAchieved: async ({ userId }) => {
    // 報酬付与など
  },
});
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
