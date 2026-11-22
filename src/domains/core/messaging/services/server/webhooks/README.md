# webhooks（provider の webhook と計測の門）

## Overview

provider（Resend・SendGrid など）の事件を配達の行と記録に当てる。受け口は 1 本 `POST /api/webhook/messaging/[channel]/[provider]`（`createApiRoute` public、門なし = 常に開。例 `/api/webhook/messaging/email/resend`）。

## API

- 生の本文で送信チャンネルの項目の `webhooks[provider].verify` → `normalize`（`ChannelWebhookEvent`）→ `applyEvents.ts` が当てる
- 知らない送信チャンネル・provider は 404、鍵（env）が無ければ 503、署名の誤りは 401、当てる処理の誤りは 500（provider が送り直す）
- メールの項目: Resend（`RESEND_WEBHOOK_SECRET`）と SendGrid（`SENDGRID_WEBHOOK_PUBLIC_KEY`）を lib/mail/webhooks の検証と正規化で並べる。送る時に配達の id を provider のタグ（`delivery_id`。Resend tags・SendGrid custom_args）で渡し、事件の `deliveryId` で読み戻す
- 事件の種類（メール）: `sent` / `delivered` / `deferred` / `bounced_hard` / `bounced_soft` / `complained` / `opened` / `clicked` / `dropped` / `unsubscribed` / `other`

## Internals

- `message_events` に `UNIQUE(provider, provider_event_id)` で一度だけ入れる（元の事件を `payload` に残す。保持 30 日、HTTP では返さない）。配達の行から `dispatch_id`・`message_key`・`channel` を写す（購読が読む）
- 配達の行は provider の message id で引き、無ければタグの配達の id
- 状態は前にだけ進める（queued < sending・unknown < sent < delivered < bounced・failed）。時刻（`delivered_at`・`failed_at`・`opened_at`・`clicked_at`・`complained_at`）は最初の 1 回だけ。`suppressed`・`canceled` の行は変えない
- `bounced_hard`・`complained` → `message_suppressions`（`hard_bounce` / `complaint`、scope `"*"`、source `webhook:<provider>`）。`bounced_soft` は止めない。`dropped` → `failed`
- `unsubscribed`（provider の仕組みの停止）は記録だけで好みに書かない
- 計測の門 `messagingTracking`（既定 **閉**、住所・ドメインなし）: 閉の間 `opened`・`clicked` は記録も反映もしない。開ける fork は provider 側の開封・クリックの計測も入れる（秘密を差し込む連絡は計測しない）

## Verification

- `pnpm test src/domains/core/messaging/services/server/webhooks`
