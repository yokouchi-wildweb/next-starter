# entities（messaging の表）

## Overview

連絡の表。すべて `src/registry/schemaRegistry.ts` に生成で載る（`pnpm db:push`）。値の一覧（状態・理由）と jsonb の zod は `schema.ts`、行の型は `model.ts`。

## API

- `message_dispatches`（`drizzle.ts`）: 送信。`message_key`（定義連絡の鍵。出どころは定義連絡の鍵 / DB のテンプレート `template_*` / 自由連絡はレイアウトだけ、D202）・`kind`・`category`・`target` jsonb（宛先の指定: all / role / group / 選んだ宛先の一覧）・`template_id` / `template_version`（固定した版）・`template_edited`（直した印）・`edited_fields` text[]（定義連絡の送信で管理者がテキストを編集した欄、無ければ null、D202）・`layout` / `layout_version`（レイアウトの鍵と送った版）・`values` jsonb（レイアウトの欄の中身、差し込む前の字。残し方は vars と同じ。予約・cron・失敗の再送はこれと vars だけで描く、D128）・`tags`・`scheduled_at`・`status`（`scheduled / processing / completed / completed_with_failures / cancelled` ほか）・`channel_counts` jsonb（`{ <送信チャンネル>: { targeted, sent, failed, skipped_no_address, skipped_throttled, suppressed } }`）・`headings` / `rendered` jsonb（送信チャンネルを鍵に）・`vars` jsonb（送信に 1 組の埋め込み情報の値 = 定義連絡の vars と DB のテンプレートの専用の値。秘密の鍵は落とす）・`record`（meta / vars / full）・`show_to_later_signups`（既定 false）・`deleted_at`（管理者の削除、D88）・`is_test`・`expand_cursor`・`idempotency_key`（UNIQUE）・`metadata`（`cancelReason`・`inboxImages`・`resends` など）
- `message_dispatch_recipients`（`recipient.ts`）: グループ宛ての送信の受信者の一覧（`dispatch_id`・`user_id`。送信と利用者の削除で消える）
- `message_deliveries`（`delivery.ts`）: 受信者 × 送信チャンネルの 1 行。`UNIQUE(dispatch_id, channel, recipient_key)`。lease `locked_until` + `lock_token`、送り直し `next_attempt_at`、複数の宛先 `targets` jsonb、`throttle_key`（索引 `(throttle_key, sent_at)`）。利用者を消すと `user_id` は null（`recipient_key` は残る）
- `message_events`（`delivery.ts`）: provider と内部の事件（追記だけ）。`UNIQUE(provider, provider_event_id)`、`seq`・`dispatch_id`（送信と一緒に消える）・`message_key`・`channel`
- `message_subscriber_cursors` / `message_subscriber_failures`（`subscriber.ts`）: 購読の印と失敗・隔離
- `message_inbox_items` / `message_inbox_reads` / `message_inbox_read_states`（`inbox.ts`）: お知らせ（全員・ロールは `user_id` null の共有の 1 行、`target_roles` null = 全員 / ほかは受信者ごと。送信と一緒に消える。`throttle_key`・`collapsed_count`・`collapsed_dispatch_ids`）、個別の既読、全部既読の watermark
- `message_templates` / `message_template_versions`（`template.ts`）: テンプレートと版（カテゴリー・レイアウト `layout` / `layout_version`・欄の中身 `values`・専用の埋め込み情報の宣言 `vars`、送信チャンネルの列は無い。`UNIQUE(template_id, version)`、版は追記だけ）
- `message_preferences`（`preference.ts`）: 止めた カテゴリー × 送信チャンネル × 種別（止めた時だけ行。`kind` は NOT NULL 既定 `"*"`）。`UNIQUE(user_id, category, channel, kind)`（素の列の uniqueIndex。NULL と NULLS NOT DISTINCT は drizzle-kit の push が往復しないので使わない。衝突の先も 4 列 = `MESSAGE_PREFERENCE_CONFLICT_TARGET`）。`source`・`source_message_key`・`source_dispatch_id`
- `message_suppressions`（`preference.ts`）: 宛先の停止（`address_hash`）。`UNIQUE(channel, address_hash, scope)`、`scope` `"*"` = 全カテゴリー
- `message_endpoints`（`endpoint.ts`）: 端末の帳簿。`UNIQUE(channel, address)`
- `message_idempotency_keys`（`idempotencyKey.ts`）: 保持の掃除が送信を消す時に冪等の鍵を移す先（FK なし）
- `message_overrides`（`override.ts`）: テキストの編集（`field_path` = レイアウトの欄の鍵、`layout_version` = 保存した時のレイアウトの版）。`UNIQUE(message_key, field_path)`

## Internals

- `message_key` が null の送信 = 前の送る口の送信と写した前のお知らせ。件名・本文は `headings`・`rendered`・`channel_counts` にあり、送信の読む口はそこから返す。写した前のお知らせの送信は `source` `legacy.notification`・`tags` `['legacy']`・`expand_cursor` `"~done"`（cron は拾わない）・`metadata.legacyNotificationId`。受信者ごとの監査ログ（`messaging.message.sent` / `failed`）は前の送信だけにある
- 列 `vars`（テンプレート・版）は前の名前 `embedded` から改名した。前の列がある DB は `pnpm task messaging:rename-template-vars`（`scripts/migrations/rename-template-vars.ts`、冪等）を `pnpm db:push` の前に走らせる（push が先だと列を消して足すので宣言が失われる）
- 送信の `vars` は前の列 `embedded_values`（DB のテンプレートの専用の値）をまとめた物、`system_template` は外した（その行はレイアウトと欄の中身を持つので自由連絡として読む、D171）。前の列がある DB は `pnpm task messaging:merge-dispatch-vars`（`scripts/migrations/merge-dispatch-vars.ts`、冪等）を `pnpm db:push` の前に走らせる（push が先だと `embedded_values` の値が失われる）
- 集計の注意: 前の送る口のお知らせは前の送信と写した送信の 2 つに出る。analytics は `source` `legacy.notification` の送信を受け取り箱の既読の数だけに使う

## Verification

- `pnpm db:push` の後 `pnpm db:push:check` = 0（索引を足した・変えた時）
- 移行の SQL と判断: `pnpm test src/features/core/messaging/scripts/migrations`
