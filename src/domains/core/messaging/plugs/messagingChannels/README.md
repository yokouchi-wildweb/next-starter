# channels（上流の送信チャンネルの項目）

## Overview

送信チャンネルの点（`extensionPoints.ts` の `messagingChannels`、差す側の `<ドメイン>/plugs/messagingChannels/`）に上流が出す 3 本 email・inApp・line。fork の送信チャンネル（push・SMS など）も同じ形で自分のドメインの `channels/<名前>.ts` に足す。項目の形は src/lib/messaging/README.md「受け口の項目」。

- 送信チャンネルの入切: 項目の `enabled: false` は項目が無い送信チャンネルと同じ（配達は `suppressed` + `channel_off`）。門の機能ではない
- 送信チャンネルは自分の欄を持たない: 中身はレイアウト + 欄の中身（D122）で、管理画面の入力とプレビューはレイアウトの欄の宣言とレイアウトの描き方から
- 届けた物の取り下げ `remove({ dispatchId })`（任意、D89）: 管理の削除が呼ぶ。持つ送信チャンネル = 消せる送信チャンネル（削除の見込みの `removable`）。上流は inApp だけ（お知らせの行・共有の行を消し、送信の画像を外す。何度呼んでも同じ）。email・line は持たない（送った物は残る）。fork の送信チャンネルも消せるなら持つ
- レイアウトの描き方の宣言（D124、`MessageChannelRendering`。描き方の 3 段は `../messagingLayouts/README.md`）: email = 汎用の描き方 `renderGeneric`（欄の型とブロックを宣言の順に lib/mail の部品で、全部の型、`email/genericView.tsx`）と要約から（題・画像・本文・行き先のボタン）/ inApp = 要約から（お知らせの行の中身 `{ title, body, image?, link? }`）/ line = 要約から（`shortBody ?? body` と行き先の URL）。fork の送信チャンネルも描けるものを宣言する（汎用か `summaryRenderable: true` + `renderFromSummary`）
- 表示名は項目の `label`（inApp = お知らせ）。選択肢を持たない所は `constants/channelLabels.ts` の `MESSAGE_CHANNEL_LABELS`（同じ値、テストで照合）

## Internals

### email（email/）

- 宛先 = `users.email`（削除済みを除く）。描いた html を `lib/mail` の `send()` へ渡す（描くのは宛先ごとに 1 回、冪等の鍵 = 配達の id）。`MailSendError` の分類（transient / permanent / unknown）をそのまま結果にし、ほかの例外は unknown
- 描き方（D124）: 送る口は描かずに組んだ中身 `MessageLayoutContent`（題・レイアウト・段・メールの欄だけの中身・要約）を渡す（`rendersAtSend: true`: 宛先ごとの停止のリンクを入れて描くため）。メールの項目が段に従って宛先ごとに描く: `layout` = レイアウトのメールの描き方（受け口の一覧 `layoutEmails`、`{ values, summary, theme, unsubscribeUrl?, recipient? }`。`recipient` = 受信者の表示名 `{ displayName }`、send の 1 回で利用者 id をまとめて 1 度引き、引けなければその回は送らず transient `recipient_lookup_failed`）/ `channel` = 汎用（`genericView.tsx` の `GenericEmailView`、レイアウトの email の欄を宣言の順に）/ `summary` = 要約から（`SummaryEmailView`）。件名 = 中身の題。中身の形が違う・レイアウトや描き方が無い = 送らず permanent（`render_failed`）
- 連絡ごとの描き方は持たない（前の形の連絡ごとの view はやめた、背景は `../../Internals.md`）。見た目を替えるのはレイアウトの描き方の 1 行スイッチの `.replace`（`../messagingLayouts/README.md`）。vars は渡さない（差し込み済みの欄の中身だけ）
- 描画結果に React の「クライアントで描き直す」印（`<!--$!-->`・`$RX`）があれば送らず permanent（`render_fallback`、`fallback.ts`。部品が描画中に投げても `@react-email/render` はほぼ空のメールを返すため）
- 配信停止: ヘッダ（`List-Unsubscribe`・`List-Unsubscribe-Post`）はワンクリックの URL、本文の最後のリンクは門 `messagingPreferences` が開なら好みのページ（`preferencesPageUrl`）、閉なら確認のページ（`unsubscribePageUrlOf`、../../services/server/unsubscribe/README.md）
- 色は `@/lib/mail` の `MAIL_THEME_COLORS`（生成物 `src/lib/mail/generated/themeColors.ts`）

### inApp（inApp/）

- お知らせ = `message_inbox_items`。宛先 = 利用者の id。選んだ宛先・グループ宛て・中身が受信者に依る送信は受信者ごとの行（同じ送信 × 利用者の行があれば書かない）
- 全員・ロール宛てで中身が受信者に依る鍵（`recipientName`・`recipientEmail`・enrichers の鍵など）を使わない送信は、cron の展開が送信に 1 行の共有の行を書く（../../services/server/sweep/README.md）
- 行 = 要約の列（`title` = 題・`body` = 短い本文か本文・`image`・`link` = 行き先の URL）+ レイアウトの鍵・版・お知らせの欄の中身（`layout`・`layout_version`・`values`、D121）。送る口は描かずに `MessageLayoutContent` + `layoutVersion` を渡す（`rendersAtSend: true`）。詳細の画面がレイアウトのお知らせの描き方で描く
- 行は記録ではなく届けた中身: 記録の段・required に依らずレイアウト・欄の中身を残す（D120）。秘密の値は空の字で差し込む（D130、送る口の `buildRowContent`）
- 画像（要約の列と欄の中身の中の `storage://`）は書く前に送信へ結ぶ（`bindImages`、../../services/server/inbox/README.md）。間引きのある連絡の行は送る口の取引の中で書く（形 `inAppItemRow`）

### line（line/）

- 既定は**切**（`config.ts` の `channels.line.enabled`。開ける fork は `src/config/domains/messaging.config.ts` に `channels: { line: { enabled: true } }`、LINE の Messaging API の env と機能 `userLineProfile` も開ける）
- 宛先 = `user_line_profiles.line_user_id`（機能 `userLineProfile` が閉なら宛先なし）。好みのページの連携の入口 `connectHref`
- `lib/line` の push（テキスト）に `X-Line-Retry-Key`（`lineRetryKey(冪等の鍵)`、宛先ごとに違い送り直しで同じ。受付済みの 409 = 成功）。`LineApiError` の `retryable` で分ける（429・5xx・応答なし → transient / ほかの 4xx → permanent / それ以外の例外 → unknown）。LINE が鍵を覚えるのは 24 時間で、`transientRetry` はその内に収まる

## Verification

- `pnpm test src/domains/core/messaging/channels`（`email.test.tsx` / `inApp.test.ts` / `line.test.ts`）
