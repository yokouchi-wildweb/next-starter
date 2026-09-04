# couponAttributionReward — クーポン帰属報酬

帰属ユーザー付きクーポン（`type=invite|affiliate`、`attribution_user_id` あり）が消込されたとき、**発行者へウォレット報酬を 1 回だけ付与し、専用台帳に記録する**基盤。アフィリエイト / アンバサダー / フレンドクーポンの「使われたら発行者に○%還元」を支える。

- 金額・通貨・率の決定は **下流（クーポンカテゴリのハンドラー）** の責務。本ドメインは「渡された額を冪等に・安全に付与する」ことだけを保証する
- UI は出荷しない（データレイヤのみ）。画面は下流が本 README のレシピで組む
- referralReward（登録招待の紹介関係に紐づく報酬）とは別物。こちらは **消込 1 件ごと** の任意発行者への payout

---

## データモデル

テーブル `coupon_attribution_rewards`（FK なし。couponHistory / referralReward と同じ永続台帳方針）

| 列 | 型 | 説明 |
|---|---|---|
| `coupon_id` | uuid | 消込されたクーポン |
| `coupon_history_id` | uuid **unique** | 冪等キー。消込 1 件につき報酬 1 行 |
| `recipient_user_id` | uuid | 受取人（消込時点の `coupon.attribution_user_id`） |
| `redeemer_user_id` | uuid null | 消込したユーザー（参考） |
| `wallet_type` | wallet_type_enum | 付与先ウォレット |
| `amount` | integer | 付与額（typed 列。集計は metadata 抽出不要） |
| `status` | pending / fulfilled / failed | 付与状態 |
| `wallet_history_id` | uuid null | 付与時の wallet_histories.id |
| `fulfilled_at` | timestamptz null | 付与確定時刻（期間集計はこの列） |
| `failure_reason` | text null | failed の理由（運用者向け） |
| `metadata` | jsonb | 呼び出し側の任意情報（rate / purchaseAmount / purchaseRequestId 等） |

インデックス: `(recipient_user_id, created_at)` / `(status, fulfilled_at)` / `(coupon_id)`

---

## サービス API（server）

```typescript
import { couponAttributionRewardService } from "@/features/core/couponAttributionReward/services/server";
```

### grant — 付与（冪等・tx 対応・失敗隔離）

```typescript
const result = await couponAttributionRewardService.grant(
  {
    coupon,             // 消込されたクーポン（attribution_user_id が受取人）
    couponHistory,      // 消込履歴行（id が冪等キー）
    amount: 150,        // 付与額（整数、0 以下は skipped）
    walletType: "regular_coin",
    reason: "フレンドクーポン報酬",      // wallet_histories.reason（省略可）
    reasonCategory: "bonus",           // 省略時 "bonus"
    metadata: { rate: 0.03, purchaseAmount: 5000, purchaseRequestId },
  },
  tx,                   // 外部 tx（購入完了 tx 等）。省略時は自前 tx
);
// result.status: "fulfilled" | "already_fulfilled" | "failed" | "skipped"
```

保証:
- **冪等**: 同じ `couponHistory.id` で何度呼んでも付与は 1 回（`already_fulfilled`）
- **失敗隔離**: 内部を SAVEPOINT で囲むため、付与失敗（ウォレット制約など）は外側 tx を abort させない。`failed` 行を残して `{ status: "failed" }` を返す（throw しない）。購入完了を止めない
- **自己帰属の二重防御**: `redeemer === recipient` は `skipped/self_attribution`（基底の `self_redeem_forbidden` が先に弾く前提の保険）
- ウォレット付与は `walletService.adjustBalance`（`sourceType: "system"`, `requestBatchId = coupon_history_id`）。監査 `wallet.balance.adjusted` はそちらで記録される
- 成功時 `markUserDirty(recipient)` を呼ぶ（コミット後の派生値再計算）

### retry — 失敗行の再付与（運用回復）

```typescript
await couponAttributionRewardService.retry(rewardId);
// failed / pending 行を台帳の amount / wallet_type / recipient で再付与。fulfilled 行は already_fulfilled
```

### 参照

```typescript
await couponAttributionRewardService.getByCouponHistory(couponHistoryId); // → row | null
await couponAttributionRewardService.getRecipientSummary(userId);
// → { fulfilledAmount, fulfilledCount, pendingAmount }
```

標準 CRUD（`search` / `count` 等）も利用可。汎用 `create` / `update` は台帳行を触るだけで **付与は走らない**（管理者の手動補正用。CRUD 自動監査 `coupon_attribution_reward.*` が残る）。

---

## 下流の配線レシピ（購入割引クーポン × 帰属報酬）

購入完了 tx では「買い手のウォレット付与 → `redeemWithEffect(code, userId, meta, tx)`」の順で呼ばれる（`purchaseRequest/completePurchase`）。`onRedeemed` には `context.tx` が伝搬するので、ハンドラーから同一 tx で `grant` を呼ぶ。

```typescript
// src/features/<downstream>/services/server/coupon/friendCouponHandler.ts
import { registerCouponHandler } from "@/features/core/coupon/handlers";
import { couponAttributionRewardService } from "@/features/core/couponAttributionReward/services/server";

registerCouponHandler("purchase_discount", {
  // ...validateForUse / resolveEffect は既存の purchase_discount ハンドラーを踏襲

  async onRedeemed({ coupon, history, metadata, tx }) {
    if (!coupon.attribution_user_id) return; // 公式クーポンは報酬なし

    // 率は下流の設定（coupon.settings.rewardRate や発行者 grant の settings）から解決
    const rate = Number(coupon.settings.rewardRate ?? 0);
    const purchaseAmount = Number(metadata?.paymentAmount ?? 0);
    const amount = Math.floor(purchaseAmount * rate);

    await couponAttributionRewardService.grant(
      { coupon, couponHistory: history, amount, walletType: "regular_coin",
        reason: "フレンドクーポン報酬",
        metadata: { rate, purchaseAmount, purchaseRequestId: metadata?.purchaseRequestId } },
      tx,
    );
  },
});
```

- ハンドラー登録は `coupon/handlers/init.ts` に import を追加する（既存手順）
- `metadata.paymentAmount` 等、購入金額の受け渡しは呼び出し側（completePurchase の metadata、または purchaseRequest を `purchaseRequestId` から再取得）で解決する

### 通知（内蔵しない理由とレシピ）

通知テーブルへの書き込みは tx に乗らないため、`grant` 内で送ると外側 tx のロールバック時に「付与されていないのに通知だけ届く」不整合が起きる。通知は **tx コミット後** に送る:

```typescript
// 例: purchaseCompleteHook / routeFactory コミット後処理などから
import { notificationService } from "@/features/core/notification/services/server/notificationService";
const reward = await couponAttributionRewardService.getByCouponHistory(historyId);
if (reward?.status === "fulfilled") {
  await notificationService.sendToUserSafe(reward.recipient_user_id, {
    title: "クーポン報酬を獲得しました",
    body: `${reward.amount} コインが付与されました。`,
  });
}
```

### マイページ（本人向け API）

| メソッド | パス | 用途 |
|---|---|---|
| `GET` | `/api/me/coupon-attribution-rewards?page&limit` | 自分が受取人の報酬一覧（ページング必須、limit 上限 100） |
| `GET` | `/api/me/coupon-attribution-rewards/summary` | 累計額 / 件数 / pending 額 |

```typescript
import { useMyAttributionRewards, useMyAttributionRewardSummary }
  from "@/features/core/couponAttributionReward/hooks/useMyAttributionRewards";

const { items, hasMore, isLoading, sentinelRef } = useMyAttributionRewards(); // InfiniteScrollList に渡す
const { summary } = useMyAttributionRewardSummary();
```

### 運用

- 失敗行の検知: 管理一覧（serviceRegistry `couponAttributionReward`, admin）で `status = failed` を検索 → `retry(rewardId)` を管理ルート/タスクから呼ぶ（上流はルート未提供。必要なら下流で `createApiRoute` + admin access）
- コイン創出サマリー（`/api/admin/analytics/coin-issuance/summary`）に `coupon_attribution_reward` ソースとして自動参加（`fulfilled_at` 基準、受取人に UserFilter 適用）

---

## 関連

- `coupon`: 自己消込ガード（`self_redeem_forbidden`）、`onRedeemed` への tx 伝搬
- `couponIssuerGrant`: 発行者プログラム（申請 → 承認 → 周期発行）。報酬率などの per-user 設定はそちらの `settings`
- `referralReward`: 登録招待の紹介関係に紐づく報酬（別責務）
- `wallet`: `adjustBalance`（付与本体、監査記録）
