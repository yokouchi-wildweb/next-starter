# channels（上流の経路の項目）

## Overview

経路の受け口（`extensionPoints.ts` の `channels`）に上流が出す 3 本 email・inApp・line。fork の経路（push・SMS など）も同じ形で自分のドメインの `channels/<名前>.ts` に足す。項目の形は src/lib/messaging/README.md「受け口の項目」。

- 経路の入切: 項目の `enabled: false` は項目が無い経路と同じ（配達は `suppressed` + `channel_off`）。門の機能ではない
- 欄の表示の約束 `fieldMeta`（必須、D83）: 管理画面の文言の編集が欄ごとの見出し・説明・入力の種類に使う。email = subject（1 行）・preheader（1 行）・heading（1 行）・paragraphs（複数行の並び）・cta（`parts` = 文言 1 行・行き先 url）・footer（複数行）/ inApp = title（1 行）・body（複数行）・image（画像）・link（url）/ line = text（複数行）。fork の経路も書く。プレビューの部品の鍵 `previewComponent` は任意（上流の 3 本は持たない）
- 届けた物の取り下げ `remove({ dispatchId })`（任意、D89）: 管理の削除が呼ぶ。持つ経路 = 消せる経路（削除の見込みの `removable`）。上流は inApp だけ（お知らせの行・共有の行を消し、回の画像を外す。何度呼んでも同じ）。email・line は持たない（送った物は残る）。fork の経路も消せるなら持つ
- 表示名は項目の `label`（inApp = お知らせ）。選択肢を持たない所は `constants/channelLabels.ts` の `MESSAGE_CHANNEL_LABELS`（同じ値、テストで照合）

## Internals

### email（channels/email/）

- 宛先 = `users.email`（削除済みを除く）。描いた html を `lib/mail` の `send()` へ渡す（描くのは宛先ごとに 1 回、冪等の鍵 = 配達の id）。`MailSendError` の分類（transient / permanent / unknown）をそのまま結果にし、ほかの例外は unknown
- 描き方: 送る口は宛先に連絡の鍵（`messageKey`）を載せ、メールの項目はその鍵で生成の一覧の `view`（`messages/views/<名前>.tsx`）を引く（`loadView.ts`、束の中では連絡ごとに 1 回）。無ければ既定の `view.tsx`（欄 subject・preheader・heading・paragraphs・cta・footer を lib/mail の枠と部品で）。読めない・`EmailView` が無い = 送らず permanent（`render_failed`）
- `messages/views/<名前>.tsx` = 1 行スイッチ（`export { EmailView } from "./<名前>.default"`、fork の差し替えは `.replace`）。`EmailView` は既定と同じ props（型 `EmailViewProps`: `content` = 差し込んだ後の欄・`theme` = `MailTheme`・`unsubscribeUrl?`）。vars は渡さない（秘密を経路に出さない）
- 描画結果に React の「クライアントで描き直す」印（`<!--$!-->`・`$RX`）があれば送らず permanent（`render_fallback`、`fallback.ts`。部品が描画中に投げても `@react-email/render` はほぼ空のメールを返すため）
- 配信停止: ヘッダ（`List-Unsubscribe`・`List-Unsubscribe-Post`）はワンクリックの URL、本文の最後のリンクは門 `messagingPreferences` が開なら好みのページ（`preferencesPageUrl`）、閉なら確認のページ（`unsubscribePageUrlOf`、../services/server/unsubscribe/README.md）
- 色は `@/lib/mail` の `MAIL_THEME_COLORS`（生成物 `src/lib/mail/generated/themeColors.ts`）

### inApp（channels/inApp/）

- お知らせ = `message_inbox_items`。宛先 = 利用者の id。選んだ宛先・グループ宛て・中身が受信者に依る送信は受信者ごとの行（同じ回 × 利用者の行があれば書かない）
- 全員・ロール宛てで中身が受信者に依る鍵（`recipientName`・`recipientEmail`・enrichers の鍵など）を使わない送信は、cron の展開が回に 1 行の共有の行を書く（../services/server/sweep/README.md）
- 画像は書く前に回へ結ぶ（`bindImages`、../services/server/inbox/README.md）。間引きのある連絡の行は送る口の取引の中で書く（形 `inAppItemRow`）

### line（channels/line/）

- 既定は**切**（`config.ts` の `channels.line.enabled`。開ける fork は `src/config/features/messaging.config.ts` に `channels: { line: { enabled: true } }`、LINE の Messaging API の env と機能 `userLineProfile` も開ける）
- 宛先 = `user_line_profiles.line_user_id`（機能 `userLineProfile` が閉なら宛先なし）。好みのページの連携の入口 `connectHref`
- `lib/line` の push（テキスト）に `X-Line-Retry-Key`（`lineRetryKey(冪等の鍵)`、宛先ごとに違い送り直しで同じ。受付済みの 409 = 成功）。`LineApiError` の `retryable` で分ける（429・5xx・応答なし → transient / ほかの 4xx → permanent / それ以外の例外 → unknown）。LINE が鍵を覚えるのは 24 時間で、`transientRetry` はその内に収まる

## Verification

- `pnpm test src/features/core/messaging/channels`（`email.test.tsx` / `inApp.test.ts` / `line.test.ts`）
