# history（利用者ごとの連絡の履歴）

## Overview

管理者が 1 人の利用者に届けた連絡を見る読む口。利用者の配達（`message_deliveries.user_id`）と、その利用者の受け取り箱に見える全員・ロール宛ての共有のお知らせ（配達の行を持たない `message_inbox_items` の共有の行）を、時刻の新しい順に 1 本で返す。

- 共有のお知らせが見えるかは受け取り箱と同じ規則（`../inbox/visibility.ts` の `inboxVisibilitySql`: 公開済み・ロール・後の登録の線・お知らせの停止）。規則はそこだけで変える
- 受信者ごとの監査の行は作らない・読まない（D31）。履歴は配達と共有の行から組む

## API

- `GET /api/admin/messaging/users/[userId]/history?cursor&limit`（管理者、門の外 = 送信の管理画面を閉じても読める）→ `messagingService.listUserMessageHistory(userId, { cursor, limit })`
  - client `getAdminUserMessageHistory`（`services/client/userHistoryClient.ts`）、公開の hook `useUserMessageHistory(userId, { limit?, enabled?, observerOptions? })`（カーソルの無限スクロール）。上流は画面を出さない（利用者の管理画面などに fork が置く）
  - `limit` 既定 50、最大 100。不正な利用者 id・cursor・limit = 400、居ない利用者 = 404
  - 返す形 `{ items: UserMessageHistoryItem[], nextCursor }`。1 行 = `type`・`dispatchId`・`messageKey`・`kind`・`source`・`channel`・`status`・`headings`・`createdAt`・`sentAt`
    - `type: "delivery"`: 1 配達（1 送信チャンネル）。`status` = 配達の状態、`createdAt` = 配達を作った時刻
    - `type: "sharedInApp"`: 共有のお知らせ。`channel` は `"inApp"`、`status`・`sentAt` は null（配達の状態が無い）、`createdAt` = 公開の時刻
  - 本文・vars・宛先・provider の値・誤りの文は返さない

## Internals

- 並び = (時刻, id) の降順。時刻 = 配達の `created_at` / 共有の行の `published_at`。2 つの問い合わせをそれぞれ `limit + 1` 件読んで混ぜ、続きの印（cursor = 最後の行の時刻と id）は 1 つで両方に同じ線を引く
- 索引: 配達 = `idx_message_deliveries_user_created`、共有の行 = `idx_message_inbox_items_published_id`
- 出ない物: 配達を持たない前の送る口の送信、保持の掃除（`retention.deliveriesDays`、既定 730 日）で消えた配達（重い列だけ先に消す `deliveryContentDays`（既定 90 日）は履歴に関わらない: 履歴は本文・vars を読まない）、消した利用者の配達（`user_id` が null になる）、グループ宛て・選んだ利用者宛てのお知らせは配達の行（inApp）として出る

## Verification

- `pnpm test src/domains/core/messaging/services/server/history`
