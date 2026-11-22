# inbox（受け取り箱）

## Overview

お知らせ（`message_inbox_items`、送信チャンネル inApp の宛先）を本人が読む口。`createMeRoute`（本人に束ねる）で機能の門は持たない = 常に開（fork が自前の一覧・ベルを持つため）。門 `messagingInbox` が閉じるのはページ `/messages` と未読のモーダルだけ。画面は ../../../components/README.md。

## API

- `GET /api/me/messaging/inbox?cursor=&limit=&unreadOnly=` → `{ items: InboxItemDto[], nextCursor }`（公開の時刻・id の降順の keyset。`limit` 既定 20・最大 50。`unreadOnly=true|1`。形の誤った `cursor` は 400）
- `GET /api/me/messaging/inbox/[id]` → `InboxItemDetailDto`（見える行だけ、見えない・無い行は 404。D121・D115）= 一覧の形 + `layout`・`layoutVersion`（今の版）・`values`（書いた時の版から今の版へ読み替え済み）・`fields`（`fieldsForChannel(layout, "inApp")` = お知らせの欄の宣言、汎用の描き方が型を知る）。前の行・レイアウトが無い / 版が読めない行は 4 つとも無い = 要約のカード（行は記録の段に依らず欄の中身を持つ、D120）
- `GET /api/me/messaging/inbox/unread-count` → `{ count }`
- `POST /api/me/messaging/inbox/[id]/read` → `{ ok: true }`（見える行だけ、見えない・無い行は 404）
- `POST /api/me/messaging/inbox/read-all` → `{ ok: true }`
- `InboxItemDto` = `{ id, title, body, link, image, metadata, publishedAt (ISO), read }`（一覧は要約の列だけ: body = 短い本文か本文）。送信の中身（宛先・数・記録）と他人の情報は返さない。`image` は保存した値のまま（`storage://` の ref か URL）で、表示の部品（`AppImage`）が解決する

## Internals

### 見える行（visibility.ts の 1 か所。SQL とテスト用の同じ判定）

- 公開の時刻 ≤ 今
- 自分宛ての行（`user_id` = 見る人）か、共有の行（`user_id` null で `target_roles` が null = 全員 か 見る人のロールを含む）。グループ宛てと選んだ宛先は受信者ごとの行
- 共有の行: 送信の `show_to_later_signups` が false なら、見る人の登録より前に公開された行は見せない
- 共有の行: 好みに従う送信（`userStoppable`、kind の無い前の送信も）で、見る人が inApp か `"*"` の送信チャンネルで送信の `category` か `"*"` を止めていれば見せない（共有の行は書く時に好みを当てないので読む時に当てる）
- 削除した送信の行は消えている（inApp の `remove`。`deleted_at` は送信にだけ残る）

### 既読（readState.ts）

- 既読 = `message_inbox_reads` の行がある か 公開の時刻 ≤ `message_inbox_read_states.read_watermark_at`
- 全部既読は 1 つの取引で watermark を今に進め、公開の時刻 ≤ 今の個別の既読の行を掃く
- 静かな行（`metadata.silent = true`）は未読の数と `unreadOnly`（未読のモーダル）に入れない。ふつうの一覧には出す（`inboxSilentSql` / `isSilent`）
  - 書き手: 定義の `silent: true` の連絡（送る口が inApp の中身に印を付け、`inAppItemRow` が行の metadata に写す。その場の行・cron の送る行・間引き・共有の行のどれも同じ）と、前のお知らせの写し

### 画像（imageBinding.ts・imageBindingLedger.ts）

- 行の画像 = 要約の列 `image` と欄の中身 `values` の中の `storage://`（画像のブロックなど）。どちらも同じ対応で書き換える（`inboxItemImageRefs` / `withBoundInboxImages`）
- 持ち主は送信: 台帳の紐付け = `messaging.dispatch` / 送信の id / `inApp.image`（用途 `notification.image`）。台帳の 1 ファイルは 1 業務行にしか結べず、受信者ごとの行は同じ画像を指すため。お知らせの行は送信より長生きしない（FK cascade）
- 結ぶ: お知らせの行を書く前、送信の行を排他で持った取引の中で（共有の行 = 展開、受信者ごとの行 = inApp の送信チャンネルの `bindImages`）。`storage://` でない値は結ばない
  - 送信の actor が上げた未紐付けの `notification.image` → そのまま attach
  - 別の人の・ほかの業務行に結ばれた・用途の違う画像 → 送信ごとに 1 回 copy して複製を attach（元と ref を共有しない）。複製の失敗は投げる
  - 対応 `{ <元の参照>: <結んだ参照> }` を送信の `metadata.inboxImages` に残し、束・送り直しは同じファイルを使う
- 外す: 保持の掃除が送信を消す取引の中で detach（`record_removed`）。保持の掃除を通らずに送信が消えた画像は storage の照合（cron storage-sweep）が `existingDispatchIds`（`dispatchRecords.ts`）で外す。管理の削除（inApp の `remove`）は行を消す取引の中で送信の画像を外す（`record_removed`）

## Verification

- `pnpm test src/domains/core/messaging/services/server/inbox`（`visibility` / `inboxService` / `imageBinding`）
