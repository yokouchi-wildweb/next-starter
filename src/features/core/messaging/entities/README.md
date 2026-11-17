# entities（messaging の表）

## Overview

連絡の表。すべて `src/registry/schemaRegistry.ts` に生成で載る（`pnpm db:push`）。値の一覧（状態・理由）と jsonb の zod は `schema.ts`、行の型は `model.ts`。

## API

- `message_dispatches`（`drizzle.ts`）: 回。`message_key`・`kind`・`category`・`target` jsonb（宛先の指定: all / role / group / 選んだ宛先の一覧）・`system_template`（システムテンプレートの鍵）・`template_id` / `template_version`（固定した版）・`template_edited`（直した印）・`layout` / `layout_version`（ひな形の鍵と送った版）・`values` jsonb（ひな形の欄の中身、差し込む前の字。残し方は vars と同じ。予約・cron・失敗の再送はこれと vars だけで描く、D128）・`tags`・`scheduled_at`・`status`（`scheduled / processing / completed / completed_with_failures / cancelled` ほか）・`channel_counts` jsonb（`{ <経路>: { targeted, sent, failed, skipped_no_address, skipped_throttled, suppressed } }`）・`headings` / `vars` / `rendered` jsonb（経路を鍵に）・`record`（meta / vars / full）・`show_to_later_signups`（既定 false）・`deleted_at`（管理者の削除、D88）・`is_test`・`expand_cursor`・`idempotency_key`（UNIQUE）・`metadata`（`cancelReason`・`inboxImages`・`resends` など）
- `message_dispatch_recipients`（`recipient.ts`）: グループ宛ての回の受信者の一覧（`dispatch_id`・`user_id`。回と利用者の削除で消える）
- `message_deliveries`（`delivery.ts`）: 受信者 × 経路の 1 行。`UNIQUE(dispatch_id, channel, recipient_key)`。lease `locked_until` + `lock_token`、送り直し `next_attempt_at`、複数の宛先 `targets` jsonb、`throttle_key`（索引 `(throttle_key, sent_at)`）。利用者を消すと `user_id` は null（`recipient_key` は残る）
- `message_events`（`delivery.ts`）: provider と内部の事件（追記だけ）。`UNIQUE(provider, provider_event_id)`、`seq`・`dispatch_id`（回と一緒に消える）・`message_key`・`channel`
- `message_subscriber_cursors` / `message_subscriber_failures`（`subscriber.ts`）: 購読の印と失敗・隔離
- `message_inbox_items` / `message_inbox_reads` / `message_inbox_read_states`（`inbox.ts`）: お知らせ（全員・ロールは `user_id` null の共有の 1 行、`target_roles` null = 全員 / ほかは受信者ごと。回と一緒に消える。`throttle_key`・`collapsed_count`・`collapsed_dispatch_ids`）、個別の既読、全部既読の watermark
- `message_templates` / `message_template_versions`（`template.ts`）: テンプレートと版（文言 `content`・変数・種類、経路の列は無い。`UNIQUE(template_id, version)`、版は追記だけ）
- `message_preferences`（`preference.ts`）: 止めた 種類 × 経路 × 種別（止めた時だけ行。`kind` は NOT NULL 既定 `"*"`）。`UNIQUE(user_id, category, channel, kind)`（素の列の uniqueIndex。NULL と NULLS NOT DISTINCT は drizzle-kit の push が往復しないので使わない。衝突の先も 4 列 = `MESSAGE_PREFERENCE_CONFLICT_TARGET`）。`source`・`source_message_key`・`source_dispatch_id`
- `message_suppressions`（`preference.ts`）: 宛先の停止（`address_hash`）。`UNIQUE(channel, address_hash, scope)`、`scope` `"*"` = 全種類
- `message_endpoints`（`endpoint.ts`）: 端末の帳簿。`UNIQUE(channel, address)`
- `message_idempotency_keys`（`idempotencyKey.ts`）: 保持の掃除が回を消す時に冪等の鍵を移す先（FK なし）
- `message_overrides`（`override.ts`）: 管理画面の文言の上書き（`field_path` = ひな形の欄の鍵、`layout_version` = 保存した時のひな形の版）。`UNIQUE(message_key, field_path)`

## Internals

- `message_key` が null の回 = 前の送る口の回と写した前のお知らせ。件名・本文は `headings`・`rendered`・`channel_counts` にあり、回の読む口はそこから返す。写した前のお知らせの回は `source` `legacy.notification`・`tags` `['legacy']`・`expand_cursor` `"~done"`（cron は拾わない）・`metadata.legacyNotificationId`。受信者ごとの監査ログ（`messaging.message.sent` / `failed`）は前の回だけにある
- 集計の注意: 前の送る口のお知らせは前の回と写した回の 2 つに出る。analytics は `source` `legacy.notification` の回を受け取り箱の既読の数だけに使う

## Verification

- `pnpm db:push` の後 `pnpm db:push:check` = 0（索引を足した・変えた時）
