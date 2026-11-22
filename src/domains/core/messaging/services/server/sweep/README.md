# sweep（送信の掃き出し・保持の掃除・続きを送る）

## Overview

送る口が要求の中で送り切らなかった分を cron が送り、古い行を消す。機能の門は持たない（送る口と同じく常に開）。cron は 1 task = 1 フォルダ `src/app/api/cron/<名前>/`（`messaging-send-sweep` / `messaging-retention`）。

## Internals

### `messaging-send-sweep`（毎分、`* * * * *` UTC、予算 `sweep.budgetMs`）

1 回の実行で順に（`sweep.ts`）:

1. `sending` のまま lease（`locked_until`）が切れた配達を `unknown` にする（落ちた処理の痕跡。自動で送り直さない）
2. 予約の時刻が来た `scheduled` の送信を `processing` にする（削除した送信 = `deleted_at` ありは拾わない、D88）
3. 大きな送信・全員・ロール・グループ宛ての送信を `expand_cursor` から 1 束ずつ展開（削除した送信は展開しない。`expandStep.ts`、`sweep.expandChunksPerRun` 束まで）。`expand_cursor` = null（まだ）/ keyset の印か `i:<番号>`（途中）/ `MESSAGE_EXPAND_DONE`（`"~done"`）
4. `next_attempt_at <= now` の配達を lease で取り（`FOR UPDATE SKIP LOCKED` で `sending` + `locked_until` + `lock_token`）、送信に残したレイアウトと版・欄の中身・vars だけで描き直して送信チャンネルの send へ（`sendStep.ts`・`../sendMessage/dispatchResolved.ts`。定義・テンプレートは引き直さない、D128）。書き込みは `lock_token` が合う時だけ。`transient` は `transientRetry` の間で送り直し、尽きたら `failed`。複数の宛先は一時の失敗の宛先だけを送り直す
5. 展開を終え `queued` / `sending` / 送り直し待ちの無い送信を閉じる（`complete.ts`）: `channel_counts` を数え直し `completed` / `completed_with_failures`、`record: "meta"` なら送るために置いた `vars` を消す

- 定義が生成の一覧に無い・検査に落ちる送信の配達は `failed`（`definition_missing` / `definition_invalid`）。送信チャンネルの項目が無ければ `suppressed` + `channel_off`

### 展開（expandStep.ts）

- 全員・ロール: **送り始めの線** = 送信の `scheduled_at ?? created_at` 以前に登録した利用者だけを keyset で束ごとに（`resolveTargetChunk`）
- グループ: 最初の 1 回で 1 文の `INSERT … SELECT` により 1 つの時点の一員（利用できる利用者・線以前の登録）を `message_dispatch_recipients` へ書く（配達の行は作らない）。その後は一覧だけから束ごとに配達を作る（お知らせは受信者ごと、共有の行は作らない）。固定の時にグループが使えない（門 `userGroups` が閉・しまった・壊れた・版が無い・人数の上限・時間の上限）→ 配達を 1 つも作らずに送信を `cancelled` にし `metadata.cancelReason` に理由
- 全員・ロール・グループ: 宛先の無い利用者は行を作らず `skipped_no_address`、止めた利用者は `suppressed` に数える。選んだ宛先の一覧は理由つきの行
- 全員・ロール宛てのお知らせ（inApp）は、中身が受信者に依らなければ最初の束で送信に 1 行の共有の行（`user_id` null、`target_roles` = ロールか null）を書き、受信者ごとの inApp の配達は作らない（数は束ごとに targeted・sent へ）

### 続きを送る

- `messagingService.continueSending(dispatchId)`: 1 つの送信を 1 束だけ（展開 1 束 + 送る 1 束 + 閉じられるなら閉じる）。`processing` 以外は 409。管理の口（../admin/README.md）
- **Vercel Hobby では cron が 1 日 1 回**（`pnpm generate cron -- --plan hobby`）。送信は遅れるだけで壊れない（最初の束は要求の中、残りは翌日か「続きを送る」）。送信を使うなら毎分の cron（Pro か外のスケジューラから `pnpm task --due`）を勧める

### `messaging-retention`（毎日 `45 18 * * *` UTC）

`retention` の日数を過ぎた行を `FOR UPDATE SKIP LOCKED` の束で消す（`retention.ts`、SQL は `retentionSql.ts`）:

- 事件 30 日（購読の印より新しい事件は残す）/ 配達 90 日（`queued`・`sending` は残す）
- 送信 730 日: お知らせが参照する送信と `processing`・`scheduled` の送信は残す。消す前に `idempotency_key` を `message_idempotency_keys` へ移し、送信に結んだお知らせの画像を台帳から外す（同じ取引、結果の `detachedImages`。実物は commit の後に消す）
- 移した鍵は `idempotencyKeyDays`（既定 null = 無期限）

## Verification

- `pnpm test src/domains/core/messaging/services/server/sweep`（`sweep.test.ts`。`groupSend.db.test.ts` は `DATABASE_URL` がある時だけ、先に `pnpm db:push`）
