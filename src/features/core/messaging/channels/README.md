# channels（上流の経路の項目）

## Overview

経路の受け口（`extensionPoints.ts` の `channels`）に上流が出す 3 本 email・inApp・line。fork の経路（push・SMS など）も同じ形で自分のドメインの `channels/<名前>.ts` に足す。項目の形は src/lib/messaging/README.md「受け口の項目」。

- 経路の入切: 項目の `enabled: false` は項目が無い経路と同じ（配達は `suppressed` + `channel_off`）。門の機能ではない
- 経路は自分の欄を持たない: 中身はひな形 + 欄の中身（D122）で、管理画面の入力とプレビューはひな形の欄の宣言とひな形の描き方から（指令 59）
- 届けた物の取り下げ `remove({ dispatchId })`（任意、D89）: 管理の削除が呼ぶ。持つ経路 = 消せる経路（削除の見込みの `removable`）。上流は inApp だけ（お知らせの行・共有の行を消し、回の画像を外す。何度呼んでも同じ）。email・line は持たない（送った物は残る）。fork の経路も消せるなら持つ
- ひな形の描き方の宣言（D124、`MessageChannelRendering`。描き方の 3 段は `../layouts/README.md`）: email = 汎用の描き方 `renderGeneric`（欄の型とブロックを宣言の順に lib/mail の部品で、全部の型、`email/genericView.tsx`）と要約から（題・画像・本文・行き先のボタン）/ inApp = 要約から（お知らせの行の中身 `{ title, body, image?, link? }`）/ line = 要約から（`shortBody ?? body` と行き先の URL）。fork の経路も描けるものを宣言する（汎用か `summaryRenderable: true` + `renderFromSummary`）
- 表示名は項目の `label`（inApp = お知らせ）。選択肢を持たない所は `constants/channelLabels.ts` の `MESSAGE_CHANNEL_LABELS`（同じ値、テストで照合）

## Internals

### email（channels/email/）

- 宛先 = `users.email`（削除済みを除く）。描いた html を `lib/mail` の `send()` へ渡す（描くのは宛先ごとに 1 回、冪等の鍵 = 配達の id）。`MailSendError` の分類（transient / permanent / unknown）をそのまま結果にし、ほかの例外は unknown
- 描き方（D124）: 送る口は描かずに組んだ中身 `MessageLayoutContent`（題・ひな形・段・メールの欄だけの中身・要約）を渡す（`rendersAtSend: true`: 宛先ごとの停止のリンクを入れて描くため）。メールの項目が段に従って宛先ごとに描く: `layout` = ひな形のメールの描き方（受け口の一覧 `layoutEmails`、`{ values, summary, theme, unsubscribeUrl? }`）/ `channel` = 汎用（`genericView.tsx` の `GenericEmailView`、ひな形の email の欄を宣言の順に）/ `summary` = 要約から（`SummaryEmailView`）。件名 = 中身の題。中身の形が違う・ひな形や描き方が無い = 送らず permanent（`render_failed`）
- 連絡ごとの描き方（前の `messages/views/`）は無い。見た目を替えるのはひな形の描き方の 1 行スイッチの `.replace`（`../layouts/README.md`）。vars は渡さない（差し込み済みの欄の中身だけ）
- 描画結果に React の「クライアントで描き直す」印（`<!--$!-->`・`$RX`）があれば送らず permanent（`render_fallback`、`fallback.ts`。部品が描画中に投げても `@react-email/render` はほぼ空のメールを返すため）
- 配信停止: ヘッダ（`List-Unsubscribe`・`List-Unsubscribe-Post`）はワンクリックの URL、本文の最後のリンクは門 `messagingPreferences` が開なら好みのページ（`preferencesPageUrl`）、閉なら確認のページ（`unsubscribePageUrlOf`、../services/server/unsubscribe/README.md）
- 色は `@/lib/mail` の `MAIL_THEME_COLORS`（生成物 `src/lib/mail/generated/themeColors.ts`）

### inApp（channels/inApp/）

- お知らせ = `message_inbox_items`。宛先 = 利用者の id。選んだ宛先・グループ宛て・中身が受信者に依る送信は受信者ごとの行（同じ回 × 利用者の行があれば書かない）
- 全員・ロール宛てで中身が受信者に依る鍵（`recipientName`・`recipientEmail`・enrichers の鍵など）を使わない送信は、cron の展開が回に 1 行の共有の行を書く（../services/server/sweep/README.md）
- 行 = 要約の列（`title` = 題・`body` = 短い本文か本文・`image`・`link` = 行き先の URL）+ ひな形の鍵・版・お知らせの欄の中身（`layout`・`layout_version`・`values`、指令 60・D121）。送る口は描かずに `MessageLayoutContent` + `layoutVersion` を渡す（`rendersAtSend: true`）。詳細の画面がひな形のお知らせの描き方で描く
- 記録の段が meta・秘密を差し込む連絡の行は欄の中身を残さない（`layout`・`values` は null = 要約のカード、`inboxContentWithoutValues`）。秘密の値は空の字で差し込む（D130、送る口の `buildRowContent`）
- 画像（要約の列と欄の中身の中の `storage://`）は書く前に回へ結ぶ（`bindImages`、../services/server/inbox/README.md）。間引きのある連絡の行は送る口の取引の中で書く（形 `inAppItemRow`）

### line（channels/line/）

- 既定は**切**（`config.ts` の `channels.line.enabled`。開ける fork は `src/config/features/messaging.config.ts` に `channels: { line: { enabled: true } }`、LINE の Messaging API の env と機能 `userLineProfile` も開ける）
- 宛先 = `user_line_profiles.line_user_id`（機能 `userLineProfile` が閉なら宛先なし）。好みのページの連携の入口 `connectHref`
- `lib/line` の push（テキスト）に `X-Line-Retry-Key`（`lineRetryKey(冪等の鍵)`、宛先ごとに違い送り直しで同じ。受付済みの 409 = 成功）。`LineApiError` の `retryable` で分ける（429・5xx・応答なし → transient / ほかの 4xx → permanent / それ以外の例外 → unknown）。LINE が鍵を覚えるのは 24 時間で、`transientRetry` はその内に収まる

## Verification

- `pnpm test src/features/core/messaging/channels`（`email.test.tsx` / `inApp.test.ts` / `line.test.ts`）
