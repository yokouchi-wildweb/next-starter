# couponAttributionReward — クーポン帰属報酬

## Overview

- 帰属ユーザー付きクーポン（`type=invite|affiliate`、`attribution_user_id` あり）が消込されたとき、発行者へウォレット報酬を 1 回だけ付与し、専用台帳に記録する基盤。アフィリエイト / アンバサダー / フレンドクーポンの「使われたら発行者に○%還元」を支える
- 使う時・直す時の決まりは札 .claude/rules/items/features/couponAttributionReward.md にある。この README は使い方と仕組み
- 本ドメインが保証するのは「渡された額を冪等に・安全に付与する」ことだけ。金額・通貨・率は下流のクーポンカテゴリのハンドラーが決める
- 今は UI の部品を持たない。画面は下流が下の Usage のレシピで組む（core の UI の決まりは CLAUDE.md `core_ui`）
- referralReward（登録招待の紹介関係に紐づく報酬）とは別物。こちらは消込 1 件ごとの任意発行者への payout

## Usage

### 下流の配線（購入割引クーポン × 帰属報酬）

購入完了 tx では「買い手のウォレット付与 → `redeemWithEffect(code, userId, meta, tx)`」の順で呼ばれる（`purchaseRequest/completePurchase`）。`onRedeemed` には `context.tx` が伝搬するので、ハンドラーから同一 tx で `grant` を呼ぶ。

```typescript
// src/domains/<downstream>/services/server/coupon/friendCouponHandler.ts
import { registerCouponHandler } from "@/domains/core/coupon/handlers";
import { couponAttributionRewardService } from "@/domains/core/couponAttributionReward/services/server";

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

### 通知（tx コミット後に送る）

連絡の書き込みは tx に乗らないため、`grant` 内で送ると外側 tx のロールバック時に「付与されていないのに通知だけ届く」不整合が起きる。そのため通知は内蔵しない。送るのは利用者への連絡の口 `messagingService.sendMessage`（連絡の定義 `messages/<名前>.ts` は下流のドメインに置く。書き方は src/domains/core/messaging/README.md）。

```typescript
// 例: purchaseCompleteHook / routeFactory コミット後処理などから
import { messagingService } from "@/domains/messaging/services/server";
import { message as attributionRewardFulfilled } from "@/domains/<downstream>/messages/attributionRewardFulfilled";

const reward = await couponAttributionRewardService.getByCouponHistory(historyId);
if (reward?.status === "fulfilled") {
  await messagingService.sendMessage(attributionRewardFulfilled, {
    recipient: { userId: reward.recipient_user_id },
    vars: { amount: reward.amount },
    idempotencyKey: `coupon-attribution-reward:${reward.id}`,
  });
}
```

### マイページ（本人向け）

```typescript
import { useMyAttributionRewards, useMyAttributionRewardSummary }
  from "@/domains/core/couponAttributionReward/hooks/useMyAttributionRewards";

const { items, hasMore, isLoading, sentinelRef } = useMyAttributionRewards(); // InfiniteScrollList に渡す
const { summary } = useMyAttributionRewardSummary();
```

```typescript
// 下流の履歴画面（例）
const { items } = useMyAttributionRewards();
items.map((item) => ({
  date: item.fulfilled_at ?? item.createdAt,
  amount: item.amount,
  status: item.status,
  rate: item.metadata.rewardRate,            // 設定に "rewardRate" を登録した場合のみ届く
  paymentAmount: item.metadata.paymentAmount, // 同上
}));
```

### 運用

- 失敗行の検知: 管理一覧（serviceRegistry `couponAttributionReward`, admin）で `status = failed` を検索 → `retry(rewardId)` を管理ルート / タスクから呼ぶ（上流はルート未提供）

## API

### 台帳 `coupon_attribution_rewards`

FK なし（couponHistory / referralReward と同じ永続台帳方針）。

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

### サービス（server）

```typescript
import { couponAttributionRewardService } from "@/domains/core/couponAttributionReward/services/server";
```

grant — 付与（冪等・tx 対応・失敗隔離。保証は Internals）:

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

retry — 失敗行の再付与（運用回復）:

```typescript
await couponAttributionRewardService.retry(rewardId);
// failed / pending 行を台帳の amount / wallet_type / recipient で再付与。fulfilled 行は already_fulfilled
```

参照:

```typescript
await couponAttributionRewardService.getByCouponHistory(couponHistoryId); // → row | null
await couponAttributionRewardService.getRecipientSummary(userId);
// → { fulfilledAmount, fulfilledCount, pendingAmount }
```

- 標準 CRUD（`search` / `count` 等）も使える。汎用 `create` / `update` は台帳行を触るだけで付与は走らない（管理者の手動補正用。CRUD 自動監査 `coupon_attribution_reward.*` が残る）

### 本人向け API

| メソッド | パス | 用途 |
|---|---|---|
| `GET` | `/api/me/coupon-attribution-rewards?page&limit` | 自分が受取人の報酬一覧（ページング必須、limit 上限 100）。受取人向け DTO を返す |
| `GET` | `/api/me/coupon-attribution-rewards/summary` | 累計額 / 件数 / pending 額 |

### 受取人向け DTO（CouponAttributionRewardForRecipient）

一覧 API は台帳の生行ではなく `toCouponAttributionRewardForRecipient(row, { metadataKeys })` の結果を返す。発行者（受取人）は「誰が消込したか」を知れないことをデータ層で保証するため。

- 含む: `id` / `coupon_id` / `wallet_type` / `amount` / `status` / `fulfilled_at` / `createdAt` / `metadata`（許可キーのみ）
- 含まない: `redeemer_user_id` / `coupon_history_id` / `wallet_history_id`（消込者・購入へ辿れる ID）、`failure_reason`（運用者向け）、`updatedAt`、`recipient_user_id`（本人）
- 管理側（serviceRegistry の `couponAttributionReward` 一覧、stats、analytics、`getRecipientSummary`）は生行のまま。hiddenColumns だと管理側の読みまで null になる

## Extension

- `recipientVisibleMetadataKeys`（持ち主 `config.ts`、上書き `src/config/domains/couponAttributionReward.config.ts`）: 受取人向け DTO の `metadata` に通すキー。上流既定は空 = 常に `{}`（fail-closed）
- 画面で率・購入金額を出すなら下流が `["rewardRate", "paymentAmount"]` 等を登録する。`purchaseRequestId` は管理側の追跡用に書き続けてよい

## Internals

grant の保証:

- 冪等: 同じ `couponHistory.id` で何度呼んでも付与は 1 回（`already_fulfilled`）
- 失敗隔離: 内部を SAVEPOINT で囲むため、付与失敗（ウォレット制約など）は外側 tx を abort させない。`failed` 行を残して `{ status: "failed" }` を返す。購入完了を止めない
- 自己帰属: `redeemer === recipient` は `skipped/self_attribution`（基底の `self_redeem_forbidden` が先に弾く前提の保険）
- ウォレット付与は `walletService.adjustBalance`（`sourceType: "system"`, `requestBatchId = coupon_history_id`）。監査 `wallet.balance.adjusted` はそちらで記録される
- 成功時 `markUserDirty(recipient)` を呼ぶ（コミット後の派生値再計算）

集計:

- コイン創出サマリー（`/api/admin/analytics/coin-issuance/summary`）の合計には、付与の wallet の行（既定の区分 `bonus`）として `wallet_bonus_grant` に入る
- 内訳は `aggregateCouponAttributionRewardCurrentVsPrev`（`analytics/services/server/couponAttributionAnalytics.ts`、`fulfilled_at` 基準、受取人に UserFilter と除外）

## Related

- `coupon`: 自己消込ガード（`self_redeem_forbidden`）、`onRedeemed` への tx 伝搬
- `couponIssuerGrant`: 発行者プログラム（申請 → 承認 → 周期発行）。報酬率などの per-user 設定はそちらの `settings`
- `referralReward`: 登録招待の紹介関係に紐づく報酬（別責務）
- `wallet`: `adjustBalance`（付与本体、監査記録）
