# subscribers（送った後の事件の購読）

## Overview

送った後の事件（outbox）を fork のコードが受ける口。cron `messaging-subscribers`（5 分ごと）が渡す。管理の一括送信の `afterSend`（送信の直後に 1 回）とは別。上流の項目は無い（受け口だけ）。

## Usage

`<domain>/subscribers/<名前>.ts` に置いて `pnpm generate extensions`:

```ts
import type { MessageSubscriber } from "@/lib/messaging";

export const subscriber: MessageSubscriber = {
  key: "orderMailBounced",
  on: ["bounced_hard", "delivery.failed"],
  filter: { messages: ["order.shipped"], channels: ["email"] },
  handle: async (events) => { /* 事件の id と購読の鍵で冪等に */ },
};
```

- `on`: 内部の事件 `dispatch.completed`・`delivery.sent`・`delivery.failed`・`delivery.suppressed` と、webhook の事件の種類（`delivered`・`bounced_hard`・`opened` など）
- `filter?`: `{ messages?: 連絡の鍵[], channels?: 経路[] }`
- `handle(events)`: 事件の束（`MessageEvent` = `id`・`type`・`messageKey`・`dispatchId`（照合できなかった webhook は null）・`deliveryId`・`channel`・`occurredAt`・`payload`）。**少なくとも 1 回**渡る。投げると印を進めず次の実行でもう一度渡る

## Internals

- 内部の事件（`../events/internalEvents.ts`）: 元の状態の更新と同じ取引で `message_events` に書く（provider `internal`、`provider_event_id` は uuid）。**書くのは登録した購読のどれかが聞いている種類だけ**（購読が 0 なら何も書かない）。書く所: 小さな送信・cron の展開（止めた行）・送信（sent / failed / 送る直前に止めた行）・回を閉じる（`dispatch.completed`、payload `{ status, isTest }`）。前の実行で sent になった宛先は二度書かない。lease を失った処理は行も事件も書かない
- cron（`runSubscribers.ts`）: 購読ごとの印（`message_subscriber_cursors.last_seq`、GREATEST で単調）から `seq` 順に、`created_at` が now − `subscribers.lagSeconds` より前の事件だけを読み、合う事件を `batchSize` ずつ `handle` へ。成功で印を進める。`runBudgetedBatches` + 締切（`budgetMs`）
  - lag の訳: `seq` は insert の順で commit の順ではない。lag より長く commit が遅れた取引の事件は飛ぶことがある
  - 束が失敗したら 1 件ずつ渡し直し、失敗した事件で印を止める（`message_subscriber_failures.attempts`++・`last_error`）。`maxAttempts` 回失敗したら隔離（`quarantined_at`）して印を進める
  - 合う事件を読み切ったら、合わなかった事件も含め上限（lag より前の一番大きい seq）まで印を進める
  - 隔離した事件の渡し直し: `reprocessQuarantinedEvents(購読の鍵, 事件の id?)`（成功で失敗の行を消す）。隔離の行を見る画面は無い
- 保持: 購読がある時、一番遅い購読の印より新しい事件は消さない（印の無い購読 = 0）。隔離の行は事件と一緒に消える

## Verification

- `pnpm test src/features/core/messaging/services/server/subscribers` と `services/server/events`
