# messaging ドメイン

利用者への連絡（メール・お知らせ = 受け取り箱・fork の経路）の基盤。連絡の定義（`messages/<名前>.ts`、書き方は src/lib/messaging/README.md）を送る口が回（`message_dispatches`）と配達（`message_deliveries`）に記録し、経路の受け口の項目で送る。

**利用者への連絡は必ず連絡の定義 + `messagingService.sendMessage` / `sendMessageToMany` を通す**。`lib/mail` の `send()` を直に呼ぶのはメールの経路の項目だけ（回・配達の記録・配信停止・本文の残し方の決まりを 1 か所で守るため）。

利用者の口（`/api/me/messaging/endpoints`・`/api/me/messaging/inbox`）・管理の口（`/api/admin/messaging/**`、管理一覧の一括送信の作成関数、送った回の管理画面 `/admin/messaging`）と受け口を持つ。それ以外の送信画面や送信 API は呼び出し側（各ドメインの wrappers、fork の `_components/` など）が用意し、サーバー側からこのサービスを呼ぶ。

---

## ディレクトリ構成

```
src/features/core/messaging/
├── index.ts                     # 定数と型のみ再エクスポート（サービスは出さない）
├── config.ts                    # 送る口の処理の値（上書き: src/config/features/messaging.config.ts）
├── channels/                    # 経路の受け口の上流の項目 email / inApp / line（<名前>/index.ts(x) の export const channel）
├── categories/                  # 配信停止の種類の受け口の上流の項目 marketing / activity
├── enrichers/                   # 値の受け口の上流の項目 displayName（管理者の連絡の宛名）
├── bulkSendTargets/             # 管理の一括送信の対象の受け口の上流の項目 bankTransferReview
├── messages/                    # 連絡の定義 adminAnnouncement・adminDirect・adminMarketing（管理者がその場で書く連絡、種別ごと）
├── constants/
│   ├── sources.ts               # MESSAGING_SOURCES（送り元の識別子。wallet の失効の知らせが使う）
│   └── preferences.ts           # 好みのページと API の住所（門 messagingPreferences の pathPatterns と同じ値）
├── entities/
│   ├── drizzle.ts               # message_dispatches テーブル
│   ├── delivery.ts              # message_deliveries / message_events（事件。seq・dispatch_id・message_key・channel）
│   ├── subscriber.ts            # message_subscriber_cursors / message_subscriber_failures（購読の印と失敗）
│   ├── inbox.ts                 # message_inbox_items / _reads / _read_states
│   ├── template.ts              # message_templates / message_template_versions
│   ├── preference.ts            # message_preferences / message_suppressions
│   ├── endpoint.ts              # message_endpoints
│   ├── idempotencyKey.ts        # message_idempotency_keys
│   ├── override.ts              # message_overrides（管理画面の文言の上書き）
│   ├── schema.ts                # 値の一覧（状態・理由）と jsonb の Zod
│   └── model.ts                 # 入出力の型
├── services/client/
│   ├── endpointClient.ts        # 本人の端末の帳簿の API
│   ├── inboxClient.ts           # 本人の受け取り箱の API（一覧はカーソル）
│   ├── adminMessagingClient.ts  # 管理の一括送信・回の読む口・続きを送る（一覧と配達はカーソル）
│   ├── overrideClient.ts        # 管理画面の文言の上書き
│   ├── templateClient.ts        # 保存されたテンプレート（一覧はカーソル・選択肢・版）
│   └── sendClient.ts            # 管理の送るモーダル（送る・プレビュー・見込み・テスト送信・選択肢）
├── hooks/                       # useMessageEndpoints / useInboxItems / useInboxList / useInboxUnreadModal / useInboxUnreadCount / useMarkInboxItemRead / useMarkAllInboxRead / useUnsubscribe
│                                # 管理: useMessageSendModal / useAdminSendOptions / useAdminBulkSend / useAdminDispatches / useAdminDispatchFilters / useAdminDispatch / useAdminDispatchDetail / useAdminDispatchDeliveries / useContinueDispatch
│                                #       useAdminMessageTemplateList / useMessageTemplateModal / useMessageTemplateForm / useMessageTemplateVersion(s) / useAdminMessageOverrideList / useMessageOverrideEditor / useModalSession
├── components/
│   ├── InboxList/               # 入れ物: 受け取り箱の一覧（詳細・既読・すべて既読）
│   ├── InboxUnreadModal/        # 入れ物: 未読を 1 件ずつ見せるモーダル（上流の利用者の枠が置く。門 messagingInbox と config で出す）
│   ├── Unsubscribe/             # 入れ物: 配信停止の確認のページの中身（確認 → 止める → 結果）
│   ├── UnsubscribeConfirm/      # 部品: 配信停止の確認（止める種類と経路・ボタン）
│   ├── UnsubscribeResult/       # 部品: 配信停止の結果（止めた / リンクが正しくない）
│   ├── AdminBulkSend/           # 管理一覧の一括操作の作成関数 bulkMessageAction(送るモーダルの bulk)
│   ├── MessageSendModal/        # 入れ物: 送るモーダル(new / sameAs / bulk、テンプレートの呼び出し・宛先・予約・プレビュー・テスト送信・確認)
│   ├── AdminDispatchList/       # 入れ物: 送った回の一覧（絞り込み + カーソル）
│   ├── AdminDispatchDetail/     # 入れ物: 回 1 件・配達（カーソル）・続きを送る
│   ├── AdminMessageOverrideList/   # 入れ物: 文言を直せる連絡の一覧（行で直すモーダルを開く）
│   ├── AdminMessageOverrideModal/  # 入れ物: 1 連絡の文言の上書きのモーダル（欄ごとの保存・既定に戻す）
│   ├── AdminMessageTemplateList/   # 入れ物: 保存されたテンプレートの一覧（カーソル。「新しく作る」・行で作る / 直すモーダルを開く）
│   ├── AdminMessageTemplateModal/  # 入れ物: テンプレートを作る・直すモーダル（TabbedModal: 文言・変数・版の履歴。公開・取り下げ）
│   └── common/                  # 部品（props だけ）: InboxItemRow / InboxItemDetail / InboxUnreadMark / DispatchRow / DispatchStatusBadge / DispatchOperations / DeliveryRow / DeliveryStatusBadge / OverrideFieldEditor / OverrideFieldMarks / AllowedKeysHint / TemplateChannelFields / TemplateVariablesEditor / TemplateVersionList / TemplateStatusBadge / MessagePreview / SendTemplatePicker / SendContentFields / SendAudiencePicker / SendCategoryChannels / SendSchedule / SendConfirmView
└── services/server/
    ├── messagingService.ts      # 公開 API（sendMessage / sendMessageToMany・existingIdempotencyKeys・端末・受け取り箱・管理）
    ├── sendMessage/             # 新しい送る口（定義 → 回 → 展開 → 配達 → 経路の send → 記録）
    ├── sweep/                   # 送信の掃き出し・続きを送る・保持の掃除（cron messaging-send-sweep / messaging-retention）
    ├── endpoints/               # 端末の帳簿（本人の宛先の登録・削除・一覧、退会の後片付け）
    ├── unsubscribe/             # 配信停止（署名つきトークン・住所 2 つ・停止の記録・確認のページの中身）
    ├── webhooks/                # provider の webhook の事件を記録と配達の行に当てる
    ├── inbox/                   # 受け取り箱の利用者の service（見える行・既読）と画像を回に結ぶ部品（imageBinding）
    └── admin/                   # 管理の一括送信・回の読む口（DTO）・続きを送る（管理者の再検査・監査）
```

---

## 二重送信の防止（idempotencyKey）

- `idempotencyKey` を渡すと、同じ鍵の 2 回目は**送る前に** `DomainError(409)` で止まる（`message_dispatches.idempotency_key` の UNIQUE と、保持の掃除で移した鍵の表 `message_idempotency_keys` の両方を見る）
- 新しく作る送信の画面・バッチでは必ず渡す。画面なら送信フォームを開くたびに `crypto.randomUUID()` で発行し、同じフォームからの再送信では同じ鍵を使う
- バッチの再実行で送信済みの対象を除くには `messagingService.existingIdempotencyKeys(keys)`（2 つの表をページ単位に引く）。鍵の行は送る前に入るので、送れなかった回も「ある」側に入る。並走した別の実行が先に送った場合も 409 なので、呼び手は 409 を「送信済み」として扱える（実例: wallet の失効の知らせ `src/features/core/wallet/services/server/notification/expirationNoticeSender.ts`）

## 前の送る口の記録

前の送る口（`send` / `bulkSend`、S2 で消した）の回は `message_dispatches` に残り、`message_key` と `record` が null。件名・本文・数は S2 の写しが前の列から `headings`・`rendered`・`channel_counts` へ移した（前の列は S3 で消した）。回の読む口（下の「管理の送信と回の読む口」）はこの回の本文を記録の段に依らず `rendered` から返す。受信者ごとの監査ログ（`messaging.message.sent` / `failed`）は前の回だけにある（新しい送る口は配達の行で追い、受信者ごとの監査ログは書かない、D31）。写した回の形は下の「写した前のお知らせ」。

---

## 新しい送る口（sendMessage / sendMessageToMany）

連絡の定義（`messages/<名前>.ts` の `defineMessage`）を受けて送る口。

```ts
import { messagingService } from "@/features/messaging/services/server";
import { message as orderShipped } from "@/features/order/messages/orderShipped";

await messagingService.sendMessage(orderShipped, {
  recipient: { userId },          // 宛先を直に渡すなら { channel: "email", address }
  vars: { orderNo: "A-1" },       // 定義の vars の zod で検査（合わなければ 400）
  idempotencyKey: `order-shipped:${orderId}`,
});

await messagingService.sendMessageToMany(campaign, {
  audience: { type: "role", roles: ["user"] }, // か recipients: [{ userId }, …]
  vars: { title: "…" },
});
```

流れ:

1. 生成の一覧（`messageRegistry`）の上書きを `applyMessageOverride` で重ね、`validateMessageDefinition` で検査（誤りは 500、`enabled: false` は回を作らず `status: "disabled"`）。同じ検査を一覧の全件に出荷前にかけるのが `sendMessage/messageRegistry.test.ts`（L2.2、`checkMessageRegistry`。上書きを重ねた後の定義・鍵の一致・描き方の `EmailView`）
2. 冪等の鍵を `message_dispatches` と `message_idempotency_keys` の両方で確かめる（重複は 409。INSERT の UNIQUE 違反も 409）
3. 回（`message_dispatches`）を 1 行書く: `message_key`・`kind`・`category`・`audience`・`record`・`headings`・`channel_counts` など
4. 小さな送信（選んだ宛先が `smallSendMaxRecipients` 人以下）: 受信者 × 経路に展開して `message_deliveries` の行を作り、最初の束（`inRequestBatchSize` 件）を経路の受け口の項目の `send(targets)` へ渡す。残りは `queued` + `next_attempt_at` のまま cron が送る
5. 大きな送信と audience（全員・ロール・audiences）: 回の行だけを書き（`status: "processing"`）、展開と送信は cron が束ごとに行う（`expandBroadcastChunk`・`resolveAudienceChunk`）
6. 予約（入力の `scheduledAt`）: 回の行だけを `status: "scheduled"` + `scheduled_at` で書く（選んだ宛先の一覧も回の `audience` に置く）。展開も送信もしない。cron の `activateScheduled` が時刻に `processing` にして 5 と同じく展開・送信する。過ぎた時刻と `config.schedule.maxDaysAhead`（既定 90 日）より先は 400、required・秘密を差し込む連絡は予約できない（400）。予約の粒度は cron の周期（Vercel Hobby では 1 日 1 回で遅れる）

管理者が書いた文面で送る（`sendAuthored({ content, category, template?: { templateId, version }, vars?, recipients | audience, channels?, scheduledAt?, … })`、D40・D41・D85・D92）。その場で書く連絡もテンプレートを呼び出して直した文面も同じ口で、`template` の有無だけが違う:

- テンプレートを呼び出した時（`template`）: 今の公開版を回の `template_id`・`template_version` に固定する。今の公開版でなければ 409（読み込んだ後に公開し直された）。取り下げ済み・未公開は 409、無いテンプレートは 404。版の文面から直したかを回の `template_edited` に残す（テンプレートを呼び出していない回は false）
- 文面（`content`、経路ごとの欄）は回の `authored_content` に残し、予約・cron の組み直し・再送はその文面で組む（後でテンプレートを直しても送った文面のまま。`sendMessage/dispatchDefinition.ts`）。画像（`storage://`）は自由に入れられる（版に無い画像も。お知らせの行を書く時に回へ結ぶ: 操作した管理者が上げた未紐付けの `notification.image` は attach、ほかは複製）
- 定義は書いた文面から組む（`sendMessage/authoredDefinition.ts`）: 鍵 = 送るカテゴリーの種別の authored の定義の鍵（`messaging.adminAnnouncement` / `adminDirect` / `adminMarketing`、宛名 `{{displayName}}` もこの鍵に当たる）。種別が announcement・direct・marketing でないカテゴリーは 400（送る時も cron の組み直しも）・種別と経路はその種類から。**経路 = 種類の経路 ∩ その回の絞り（`channels`）で、その中に文面の無い経路が 1 つでもあれば 400**（黙って落とさない。絞りが種類の外・空も 400）。経路ごとの欄は経路の受け口の zod で検査する（LINE・fork の経路も）。`{{鍵}}` = 当たる enrichers の鍵 + テンプレートの版の変数、知らない鍵は 400。生成の一覧の上書きと管理画面の文言は重ねない（authored の定義は上書きを持てない）
- 変数の値（`vars`、回に 1 組。`template` がある時だけ、無いのに渡すと 400）は版の変数で検査する: 必須で値が無い・型（number / boolean）が合わない → 400。値は文字列にして差し込む。cron は送る時に回の vars をもう一度検査し、合わなければ送らずに止める（配達の行は `failed`、`last_error: template_vars_invalid`。版が消えた = `template_missing`）。`authored_content` の列より前のその場で書いた回（文面を持たない authored の回）は組めず `authored_missing` で止まる
- 受信者ごとの変数（`source: recipient`）は送る口から受信者ごとに渡す口が無いので、既定値を全員に使う（既定値が無いテンプレートは 400、変数の名前を出す）
- テンプレートの画像（台帳の持ち主 = テンプレート）は、お知らせの画像の結び方（`inbox/imageBinding.ts`）で回ごとに複製して回が持つ（テンプレートを消しても送った物は残る）
- プレビュー（`previewMessage`）と宛先数の見込み（`estimateRecipients`）も送る口にある（管理の送信が使う）

宛先:

- 利用者の宛先は経路の `resolveAddresses`、無ければ端末の帳簿（`message_endpoints` の有効な行）から引く。宛先が複数なら 1 行の `targets` にまとめ、1 つでも送れたら `sent`
- 選んだ宛先で宛先の無い受信者は `suppressed` + `reason: no_address` の行にして戻り値で返す。全員・ロールでは行を作らず `channel_counts.<経路>.skipped_no_address` に数える
- 経路の項目が無い・`enabled: false` の経路は `channel_off`。受信者の鍵は `user:<id>` か `addr:<正規化した宛先の sha256>`

送信の結果（ChannelError の分類）:

- `sent` → `sent` / `permanent` → `failed` / `unknown` と send が投げた例外 → `unknown`（自動で送り直さない）
- `transient`: 非 required は `queued` のまま `next_attempt_at` を広げて cron に任せる（`transientRetry`、回数が尽きたら `failed`）
- 経路の冪等の鍵 = 配達の行の id（宛先が複数なら `<id>:<番号>`）

本文の残し方（定義の `record`、既定 `vars`）:

- `meta`: 件名・題（`headings`）だけ。`vars`: + 回の vars の写しと全員同文の描画結果（`rendered`）+ 受信者ごとの値。`full`: + 受信者ごとの描いた本文（配達の `body`）
- required の連絡と、`secretVar` の印の鍵を持つ連絡は描いた本文をどこにも残さない（`record: "full"` でも。誤りの文も理由の符号だけ）。秘密の鍵は vars の写しから落とし、件名・題にも差し込まない。required は vars の写しも残さない
- これらの連絡はキューに置けないので、要求の中で送り切る（一時の失敗は `requiredRetry` の回数だけ短く再送して尽きたら `failed`）。audience と大きな送信には使えない（400）
- 送り残し（queued）がある回は cron のために vars を持ち、`record: "meta"` なら送り終えた時（cron が回を閉じる時）に消す

配信停止は下の「配信停止」、会話の間引きは下の「会話の間引き（throttle）」。受信者ごとの監査ログは書かない（管理者の操作の監査は管理の指令）。

### 会話の間引き（throttle）

定義（か override）の `throttle: { by, mode, seconds }` を持つ連絡は、経路の send の前に受信者ごとに間引く（`services/server/sendMessage/throttle.ts`。要求の中の送りも cron の送りも同じ処理を通る）。上流の定義は throttle を宣言しない（fork の定義・override で付ける）。

- 間引きの鍵 = 受信者の鍵 × `message_key` × `by` の値（回の vars）の sha256。配達の行と受信者ごとのお知らせの `throttle_key` に入る
- `untilRead`（経路に inApp がある）: 同じ鍵の未読のお知らせがあれば置き換える（中身を最新に、`collapsed_count` + 1、前の回を `collapsed_dispatch_ids` に足し `dispatch_id` は今の回、`published_at` = 今 = 未読のまま一覧の上に出る）。inApp の配達は `sent` + `reason: throttled`、他の経路は送らず `suppressed` + `throttled`（回の `skipped_throttled`）
- `window`（と inApp が経路に無い `untilRead`）: 同じ鍵の前の送り（他の回の `reason` なしの行が `seconds` 以内に sent、か送る途中）があれば間引く。inApp は未読があれば置き換え、既読なら新しいお知らせ（回数 1）。間引いた行（`reason: throttled`）は window の起点にしないので、会話が続いても window は延びない
- 最初の 1 通・window の後・既読の後はふつうに送る（鍵つきのお知らせ、回数 1）
- `{{collapsedCount}}`: ふつうの送りは 1、置き換えたお知らせはその回数（throttle のある連絡だけで使える鍵）
- 排他: 判定は鍵の `pg_advisory_xact_lock` を持った取引の中で、回 × 受信者の配達の行を読み直してから 1 度だけ行い、その受信者の全部の行に書く（`throttle_key` の入った行 = 決めた行）。同じ鍵の要求の中の送りと cron の送りが重なっても 2 通にならない。lock は経路（provider）の呼び出しの間は持たない
- お知らせの行は、throttle のある連絡では inApp の経路の send ではなくこの取引の中で書く（行の形は `channels/inApp` の `inAppItemRow`、画像は同じ取引で回に結ぶ）
- 間引くのは受信者ごとの行だけ: 全員・ロール宛ての回（共有の 1 行）はどの経路も間引かない。audiences の項目と選んだ宛先の回は間引く
- `collapsed_dispatch_ids` は FK を持たない（保持の掃除で消えた回の id も残る）。取り下げ・保持・画像はお知らせの今の `dispatch_id`（最新の回）に従う
- **会話の既読とお知らせの既読は別物**: `untilRead` が見るのは受け取り箱のお知らせの既読（`message_inbox_reads` / 全部既読の watermark）だけ。チャットの画面で会話を読んだことは messaging は知らない。会話の既読でお知らせも既読にしたいなら、その機能が受け取り箱の既読の API（`POST /api/me/messaging/inbox/[id]/read`）か messagingService の既読を呼ぶ

処理の値（`config.ts`、上書き `src/config/features/messaging.config.ts`）: `smallSendMaxRecipients` 100 / `inRequestBatchSize` 50 / `requiredRetry` 3 回（待ち 200ms・1000ms）/ `transientRetry` 初回を含め 5 回・60 秒 × 4 の累乗 / `expandChunkSize` 500 / `schedule.maxDaysAhead` 90（予約できる日数）

## 上流の経路の項目（channels/）

経路の受け口（`extensionPoints.ts` の `channels`）に上流が出す 3 本。fork の経路（push・SMS など）も同じ形で `channels/<名前>.ts` に足す。項目の形: `src/lib/messaging/README.md`「受け口の項目」。

- `email`（`channels/email/`）: 宛先 = `users.email`（削除済みを除く）。既定の描き方（`view.tsx`: 欄 subject・preheader・heading・paragraphs・cta・footer を lib/mail の枠と部品で）で描き、描いた html を `lib/mail` の `send()` へそのまま渡す（描くのは宛先ごとに 1 回。冪等の鍵 = 配達の id）。`MailSendError` の分類（transient / permanent / unknown）をそのまま結果にし、それ以外の例外は unknown
  - 描画結果に React の「クライアントで描き直す」印（`<!--$!-->`・`$RX`）があれば送らず permanent（`render_fallback`）。部品が描画中に投げると `@react-email/render` は投げずにほぼ空のメールを返すため（L2.1、`fallback.ts`）
  - 連絡ごとの描き方: 送る口と cron は宛先に連絡の鍵（`messageKey`）を載せる。メールの項目はその鍵で生成の一覧（`messageRegistry`）の `view`（`messages/views/<名前>.tsx`）を引き（`loadView.ts`、束の中では連絡ごとに 1 回）、あればその `EmailView`、無ければ既定の `view.tsx` で描く。読めない・`EmailView` が無い = コードの誤り → 送らず permanent（`render_failed`）
  - `messages/views/<名前>.tsx` の形 = 1 行スイッチ（`export { EmailView } from "./<名前>.default"`、fork の丸ごとの差し替えは `.replace`）。`EmailView` は既定と同じ props（`content` = `{{鍵}}` を差し込んだ後のメールの欄・`theme` = `MailTheme`・`unsubscribeUrl?`）を受ける（型 `EmailViewProps`、`channels/email/view.tsx`）。変数（vars）は渡さない（秘密の変数を経路に出さない。文言は欄にあるので管理画面と override で直せる）
  - 色は `@/lib/mail` の `MAIL_THEME_COLORS`（生成物 `src/lib/mail/generated/themeColors.ts`）
- `inApp`（`channels/inApp/`）: お知らせ = `message_inbox_items`。宛先 = 利用者の id。選んだ宛先の送信と中身が受信者に依る送信は受信者ごとの行（同じ回 × 利用者の行が既にあれば書かない）
  - 全員・ロール宛てで、お知らせの中身が受信者に依る鍵（`recipientName`・`recipientEmail`・enrichers の鍵など）を使わない送信は、cron の展開の最初の束で回に 1 行の共有の行（`user_id` null、`target_roles` = ロールか null）を書き、受信者ごとの inApp の配達の行は作らない（D32）。数は束ごとに `channel_counts.inApp` の targeted・sent へ足す
  - 受け取り箱の利用者の API・既読・画面は受け取り箱の指令
- `line`（`channels/line/`）: 既定は**切**（`config.ts` の `channels.line.enabled`。開ける fork は `src/config/features/messaging.config.ts` に `channels: { line: { enabled: true } }` を書き、LINE の Messaging API の env と機能 `userLineProfile` も開ける）。宛先 = `user_line_profiles.line_user_id`（機能 `userLineProfile` が閉じていれば宛先なし）。`lib/line` の push（テキスト）に `X-Line-Retry-Key`（`lineRetryKey(冪等の鍵)`。宛先ごとに違い送り直しで同じ。LINE が受付済みの 409 = 成功）を付ける。失敗は lib/line の `LineApiError` の `retryable` で分ける（429・5xx・応答なし → transient / 他の 4xx → permanent / `LineApiError` でない例外 → unknown）。LINE が鍵を覚えるのは 24 時間で、送り直し（`transientRetry`）はその内に収まる
- 経路の入切: 項目の `enabled: false` は項目が無い経路と同じ扱い（配達の行は `suppressed` + `channel_off`、送らない）。門の機能ではない

---

## 端末の帳簿（message_endpoints）

利用者 × 経路 × 宛先（プッシュの購読トークン・電話番号など）の帳簿（D43・D45）。帳簿を読むのは、自前の宛先の引き方（`resolveAddresses`）を持たない経路の項目（送る口が `message_endpoints` の有効な行から宛先を引く）。

- 受け付ける経路: 経路の受け口に項目があり、`enabled` で、`resolveAddresses` を持たない経路だけ。**上流の email・inApp・line は自前の帳簿なので受け付けない（今の上流では登録できる経路が 0 で、どれも 400）**。push・SMS などの経路を fork が足すと登録できる
- API `/api/me/messaging/endpoints`（`createMeRoute`、本人に束ねる。機能の門は持たない = 送る口と同じく常に開）
  - `GET` 本人の一覧 / `POST` 登録 `{ channel, address, kind?, metadata? }`（本人の同じ宛先は更新して有効に戻す。**他人が登録した宛先は付け替えず 409**）/ `DELETE ?id=` 本人の行を消す（他人の id は 404）
  - 返すのは安全な DTO（`id`・`channel`・`kind`・`addressHint` = 宛先の末尾 6 文字・`isActive`・`lastUsedAt`・`createdAt`）。宛先の全体と `metadata` は返さない
  - 入力の汎用の形: `address` 2048 文字まで、`kind` 32 文字まで、`metadata` は平らな値で 2KB まで・秘密は入れない
  - 経路ごとの宛先の形: 経路の項目が `endpoint: { address: <zod> }` を宣言すると、登録の口がそれで検査し（合わなければ 400）、通った値（変換の後）を残す。宣言の無い経路は汎用の形だけ。上流の email・inApp・line は帳簿を読まないので宣言しない。例（fork の SMS の経路）: `endpoint: { address: z.string().transform((v) => v.replace(/-/g, "")).pipe(z.string().regex(/^\+[1-9]\d{6,14}$/)) }`（E.164）
- 最後に使った時刻: 送る口（要求の中と cron）が、帳簿を読む経路で送れた（`sent`）宛先の `last_used_at` を経路ごとに 1 回の UPDATE で記録する。送れなかった宛先は記録しない。記録が失敗しても送信の結果は変えない（警告だけ）
- client: `services/client/endpointClient.ts`、hook `useMessageEndpoints()`（`{ endpoints, register, remove, … }`）。宛先を渡して登録するだけで、通知の許可・Service Worker・ネイティブの SDK は fork が持つ
- 退会: user の後片付けの項目 `cleanupHandlers/messagingEndpoints.ts`（required: 個人の情報なので失敗したら退会ごと戻す）が本人の行を全部消す

---

## 配信停止（種類・好み・宛先の停止）

D35。単位 = 種類 × 経路。連絡の定義の `category` が種類の鍵（`categories/` の受け口。上流は `marketing`・`activity`、fork は `categories/<名前>.ts` で足す）。

- 好みに従う連絡 = 種別の性質 `userStoppable`（activity・marketing）で `required` でない連絡。ほかの種別と required は好みを見ない。住所の停止は種別の性質 `addressStop`（functional・security は hard bounce だけ、ほかは苦情・ワンクリック・手作業も）
- 好み（`message_preferences`、止めた時だけ行）: 利用者 × 種類 × 経路。種類・経路の `'*'`（`MESSAGE_ALL`）は全部に当たる。種別まるごとの行（`kind` X、`'*'` `'*'`）は種別 X の連絡の全種類・全経路に当たる（fork が後から足す種類にも）。`kind` が `'*'`（既定、種別まるごとではない）の行は今までどおり、`kind` のある行は連絡の種別が同じ時だけ当たる（service と偽物の store の行は `'*'` を null で持ち、読み替えは `preferences/store.ts` だけ）。当たる行が 1 つでもあれば止める（和、許可の行・優先の順は無い。D71）。送る口（`findOptOuts` → `checkStops`）・受け取り箱の見え方（`inbox/visibility.ts` の SQL と `isVisible`）・好みの見え方（`preferenceVia`）の 3 か所が同じ判定
- 宛先の停止（`message_suppressions`、正規化した宛先 = 前後の空白を外して小文字の sha256）: required でない連絡は `hard_bounce`・`complaint`・`manual` にいつも従い、`one_click` は範囲（scope）が連絡の種類か `'*'` の時だけ従う。required は `hard_bounce` だけに従う。宛先が複数なら止めた宛先だけを外す
- 確かめる所: 小さな送信の展開・cron の展開・cron が送る直前（キューに置いた後で止めた人も外す。宛先の 1 つにもう送れた行は sent のまま送り直しをやめる）
- 外した受信者: 選んだ宛先は `suppressed` + reason `preference` / `suppression` の行、全員・ロール・audiences は行を作らない。どちらも `channel_counts.<経路>.suppressed` に数え、どの経路でも止められた受信者は `recipient_count` から引く（D31）
- 全員・ロール宛てのお知らせの共有の 1 行は、書く時に利用者ごとの inApp の好みを当てない。受け取り箱の利用者の API（後の指令）が、回の `category`（`dispatch_id` で引ける）と見る人の inApp の好みで共有の行を外す
- メール（D35・D57）: 好みに従う連絡の宛先には、送る口が `category` と、署名の鍵の env があれば `List-Unsubscribe: <停止の URL>`・`List-Unsubscribe-Post: List-Unsubscribe=One-Click`（RFC 8058）を付ける（経路の宛先 `ChannelSendTarget` の `category`・`headers`）。メールの項目はヘッダを lib/mail に渡し、本文の最後に停止のリンクを出す
  - **決まり: `category` があるのに `List-Unsubscribe` が無い = 鍵（`MESSAGING_UNSUBSCRIBE_SECRET`）が無い → そのメールは送らず permanent（reason `unsubscribe_key_missing`）**。好みに従わない連絡（activity・marketing 以外・required）はヘッダなしで送る
  - 本文の停止のリンクの先: 門 `messagingPreferences` が開なら好みのページ（`getAppBaseUrl()` + `/mypage/account/notifications`）、閉ならワンクリックの URL（ヘッダと同じ）。ヘッダ（`List-Unsubscribe`・`List-Unsubscribe-Post`）は門に関わらずワンクリックの URL のまま（メールの項目の `preferencesPageUrl`、`channels/email/index.tsx`）
  - provider の一括停止の機能は使わない

## 管理画面の文言の上書き（message_overrides・/api/admin/messaging/overrides）

D21・D24・D28。定義が `adminEditable` で宣言した欄だけを、管理者が管理画面で直せる（デザインと変数はコードの層のまま）。

- 門: 規則 `messagingOverrides`（`src/featureGate/rules/messagingOverrides.ts`、`dependsOn: ["messagingDispatches"]`、既定 閉、住所は管理の画面 `/admin/messaging/overrides` と API `/api/admin/messaging/overrides`）。閉の間 画面と API は 404 で、送る口は DB の値を使わない。表は門に関わらず残る
- 表 `message_overrides`: 直した欄だけ行（`message_key`・`field_path` = `<経路>.<欄>`・`value`・`code_value` = 直した時のコードの値・`updated_by`、UNIQUE(message_key, field_path)）。既定に戻す = 行を消す
- 重なる順（門が開の時）: 管理画面の値 > fork の override > 上流の既定（欄ごと）。重ねる所は `resolveDefinition` の 1 か所（小さい送り・cron の展開・cron の送り）で、定義ごとに 1 回だけ読む（宛先ごとには読まない）
- 送る時の検査は保存と同じ（lib/messaging `checkAdminFieldValue`）: 今も `adminEditable` にある・欄の型・配列はコードと同じ長さ・`{{鍵}}` は vars（秘密を除く）∪ 共通の文脈 ∪ provides。通らない欄（孤立）はその欄だけコードの値で送り、警告を出す
- 管理の service（`services/server/overrides`、`messagingService.listMessageOverrides` / `getMessageOverrides` / `saveMessageOverride` / `resetMessageOverride`。service でも管理者を確かめる）
  - 一覧: fork の override を重ねた後に `adminEditable` がある（か行が残る）連絡と数（直した・孤立・コードが変わった）
  - 1 件: 欄ごとに `codeValue`・`value`・`effective`（送る時の値）・`edited`・`codeChanged`（直した時のコードの値と今のコードの値が違う）・`orphan` + `problem`、直せなくなった欄の行（`editable: false`、戻すだけ）、使ってよい鍵 `allowedKeys`
  - 保存 `PUT /[key]` `{ fieldPath, value }`（誤りは 400）/ 戻す `DELETE /[key]?field=<経路.欄>`（行が無ければ 404）。監査 `messaging.override.updated` / `messaging.override.reset`（対象 `message_override`、`<鍵>:<欄>`。値は残さない）
- 上流で直せる連絡: `user.registrationComplete` / `user.earlyRegistrationComplete`（email の subject・heading・paragraphs）、`wallet.expiringNotice` / `wallet.expiredNotice`（email の subject・paragraphs、inApp の title・body）、`wallet.adjustmentNotice`（inApp の title・body）。URL を持つ cta・preheader・footer はコードだけ。認証の連絡・required・管理者がその場で書く連絡 3 本は直せない
- fork の連絡も定義か `.override.ts` で `adminEditable` を宣言できる（required は不可）。欄の名前の変更・削除で行は孤立し、コードの値で送られる（付け替えの task は無い）

### 文言の上書きの管理画面（`/admin/messaging/overrides`、門 `messagingOverrides`）

- `/admin/messaging/overrides`: 入れ物 `AdminMessageOverrideList`（props なし）= 直せる連絡の行（鍵・種別 / 種類・直せる欄の数・直した / 孤立 / コードが変わったの数）。行を押すと直すモーダル。1 件のページ（`/overrides/[key]`）は無い（D87）
- モーダル: 入れ物 `AdminMessageOverrideModal`（`open`・`onOpenChange`・`messageKey | null`。開閉は置き場が持つ。fork は自分の画面にも置ける）= 使える `{{鍵}}` の案内 + 欄ごとの編集。保存していない欄があるまま閉じる = `confirmOnClose`、ページの移動 = `@/lib/unsavedGuard`、開き直すたびに下書きを捨てる。文字の欄 = Textarea 1 つ、段落（配列）= 段落ごとの Textarea（数はコードのまま）。保存・既定に戻すは欄 1 つずつ（API が欄 1 つずつ）。直した欄にはコードの値も出す。直せなくなった欄は既定に戻すだけ
- 部品（props だけ、`components/common/`）: `OverrideFieldEditor`（欄 1 つ。`overrideFieldLabel(path)` = 経路 / 欄の表示名）・`OverrideFieldMarks`（直した・コードが変わった・孤立・直せなくなった・未保存）・`AllowedKeysHint`（使える鍵と、文の中の使えない鍵）
- hook: `useMessageOverrides`（一覧、SWR）・`useAdminMessageOverrideList()`（一覧 + モーダルの開き先 `modal.openMessage(key)`）・`useMessageOverride(key)`（1 件、SWR）・`useMessageOverrideEditor(key)`（欄ごとの下書き・`unknownKeys`・`save` / `reset` / `discard`・`closeConfirm`。保存と戻すは 1 件と一覧を取り直す。下書きがある間は `@/lib/unsavedGuard` で離れる前に確かめる）・純粋な関数 `unknownKeysOf` / `toEditable`。client は `services/client/overrideClient.ts`
- loader は認可（`roleCategories: ["admin"]`）と門（閉なら notFound）だけ。管理メニュー: `src/features/core/admin/menu/items/messagingOverrides.ts`（マーケティング > 文言の上書き、門が閉なら隠れる）

## 保存されたテンプレート（/api/admin/messaging/templates）

D40・D41。管理者が画面で書く連絡の中身と、その版の履歴（`services/server/templates`、`messagingService.*MessageTemplate*`。service でも管理者を確かめる）。テンプレートで送る口（版の固定・予約・プレビュー・テスト送信）は次の段。

- 門: 規則 `messagingTemplates`（`src/featureGate/rules/messagingTemplates.ts`、`dependsOn: ["messagingDispatches"]`、既定 閉、住所は管理の画面 `/admin/messaging/templates` と API `/api/admin/messaging/templates`）。閉の間 画面と API は 404
- 状態: `draft`（まだ公開していない）→ `published`（版がある）→ `archived`（取り下げ。直せない・公開できない、版は残る）
- 行 = 今の中身（下書き）。公開 = 今の中身を `message_template_versions` に版として追記し `current_version` を進める。**公開した版は書き換えない**（公開済みを直すと行だけが変わり、`hasUnpublishedChanges` が立つ。次の公開で新しい版）。版は文言・変数・種類を持つ（経路は持たない: 文言の鍵 = 文言のある経路、D85。回は送る時に版を固定し、最新を引き直さない）。前の版から変更の無い公開は 409
- 保存時の検査（作る・直す・公開の前、`templates/checks.ts`）: `content` の鍵は経路の受け口にあり有効な経路の鍵、少なくとも 1 つの経路に文言、各経路の欄の zod を通る（入力に `channels` は無い）/ 種類は種類の受け口にあり、種別が announcement・direct・marketing（それ以外は 400）/ 変数は `MessageTemplateVariableSchema` の並びで鍵は一意・`{{鍵}}` に書ける形 / 本文の `{{鍵}}` は 共通の文脈 ∪ 管理の定義 3 本のどれにも当たる provides ∪ 宣言した変数 の中だけ（`allowedKeys` で返す）
  - **秘密はテンプレートを通さない**: 型 `secret` の変数と、共通の文脈・throttle・provides と同じ鍵の変数は宣言できない（秘密の値はコードの定義の `secretVar` に置く）
- 画像: 中身の `storage://` の参照（`inApp.image` など）は保存の時に台帳でテンプレートの行に結ぶ（record `messaging.template` / テンプレートの id / `content`、用途 `notification.image`）。自分が上げた未紐付けの画像は attach、他の業務行に結ばれた・別の人の画像は複製して参照を書き換える。下書きから画像を外しても台帳からは外さない（公開した版が使う）。storage の照合（cron storage-sweep の `recordResolvers`）はテンプレートの行があれば残し、無ければ外す。送る時は回が自分の写しを持つ（次の段）
- API（admin のみ）: `GET /` 一覧（`status`・`cursor`・`limit`）/ `POST /` 作る / `GET・PATCH /[id]` / `POST /[id]/publish` / `POST /[id]/archive` / `GET /[id]/versions`（新しい順）/ `GET /[id]/versions/[version]` / `GET /options`（画面の選択肢: 有効な経路 `{key, label}`・種類 `{key, label, description}`（3 つの種別の種類だけ）・変数の前から使える鍵 `baseAllowedKeys`。経路と種類は受け口なので fork の物も入る）。返す形は `services/server/templates/dto.ts`
- 監査: `messaging.template.created` / `updated` / `published`（版の番号）/ `archived`（対象 `message_template`）

### 保存されたテンプレートの管理画面（`/admin/messaging/templates`、門 `messagingTemplates`）

- `/admin/messaging/templates`: 入れ物 `AdminMessageTemplateList`（props なし）= 状態で絞る + 「新しく作る」+ 行（状態と版・名前・鍵・種類・更新）の無限スクロール（カーソル）。行を押すと直すモーダル。作る・1 件のページ（`/templates/new`・`/[id]`）は無い（D87）
- モーダル: 入れ物 `AdminMessageTemplateModal`（`open`・`onOpenChange`・`templateId?`（null = 作る）・`onChanged?`。開閉は置き場が持つ。部品は公開の部品だけなので fork は自分の画面にも置ける）= `TabbedModal` のタブ 文言（鍵は作る時だけ・名前・説明・カテゴリー（`GET /options` = 種別 announcement・direct・marketing のカテゴリー）・使える `{{鍵}}` の案内（`AllowedKeysHint`）・経路ごとの文言）/ 変数 / 版の履歴（直す時だけ、下の帯なし）。下の帯 = 取り下げ・公開（`ConfirmPopover`。公開は保存済みで公開していない変更がある時だけ）・保存。作った後は同じモーダルでその 1 件を直す形に変わる（ページは移らない）。取り下げたテンプレートは読むだけ。書きかけのまま閉じる = `confirmOnClose`、ページの移動 = `@/lib/unsavedGuard`
- 部品（props だけ、`components/common/`）: `TemplateChannelFields`（email = 件名・プレヘッダー・見出し・段落（空行で区切る 1 つの欄）・ボタン・フッター / inApp = 題・本文・画像（`ManualMediaUploader`、用途 `notification.image`。保存の時にサーバーがテンプレートに結ぶ）・行き先 / line = 本文 / それ以外の経路 = 欄の JSON）・`TemplateVariablesEditor`（鍵・表示名・型 string / number / date / url・由来・既定値・必須）・`TemplateVersionList`（版の一覧と 1 版の中身、読むだけ）・`TemplateStatusBadge`（下書き・公開中 v<n>・取り下げ・未公開の変更）
- hook: `useMessageTemplates`（カーソル）・`useAdminMessageTemplateList({ observerOptions? })`（状態の絞り + 一覧 + モーダルの開き先 `modal.openNew()` / `modal.openTemplate(id)`）・`useMessageTemplate(id)` / `useMessageTemplateOptions(enabled?)`（SWR）・`useMessageTemplateVersions(id)`・`useMessageTemplateVersion(id, version)`（1 版、SWR。画面には置いていない）・`useMessageTemplateModal({ open, templateId?, onChanged? })`（開いている間だけ選択肢・1 件・版を取る・`state`（作った直後など 1 件がまだ無い間は loading）・タブ・`onCreated`・書く欄の key `formKey`）・`useMessageTemplateForm({ template, options, onCreated?, onChanged? })`（`onChanged(返った 1 件, "create" | "update" | "publish" | "archive")` = 一覧へ知らせる。一覧 `useAdminMessageTemplateList` の `modal.onChanged` は 作った = 先頭から取り直す・ほか = 行を置き換える・状態で絞っていて外れた行は外す。無限スクロールには SWR の再検証が届かないため・書く欄・`dirty`（離れる前の確認 `@/lib/unsavedGuard`）・`closeConfirm`・`allowedKeys` = `baseAllowedKeys` ∪ 変数・`unknownKeys`・`save` / `publish` / `archive`・`canPublish`・`createdId`）・`useModalSession(open)`（閉 → 開 の度に増える番号。開き直しで書く欄を作り直す key）・純粋な関数 `contentForInput` / `emptyChannelContent`。client は `services/client/templateClient.ts`
- loader は認可（`roleCategories: ["admin"]`）と門（閉なら notFound）だけ。管理メニュー: `src/features/core/admin/menu/items/messagingTemplates.ts`（マーケティング > テンプレート、門が閉なら隠れる）

## 好みの読み書き（利用者の API /api/me/messaging/preferences）

D35・D45・D71。本人が好みを見て切り替える口（`services/server/preferences`、`messagingService.getMessagePreferences` / `setMessagePreference`）。

- 止め方は 5 つ: 1 マス `{ category, channel }`・種類まるごと `{ category, channel: '*' }`・経路まるごと `{ category: '*', channel }`・全部 `{ '*', '*' }`・種別まるごと `{ kind }`（種別まるごとは上流の画面に出さない）。知らない種類・利用者が止められない種類・開いていない経路は 400
- `setMessagePreference(userId, input, { source? })`: `source` = 書いた入口（既定 `user`、会員登録の同意なしは `signup` = `constants/preferences.ts` の `PREFERENCE_SIGNUP_SOURCE`）。サーバーの呼び手だけが渡す（API の本文からは受けない）

- 門: 規則 `messagingPreferences`（`src/featureGate/rules/messagingPreferences.ts`、住所 ページ `/mypage/account/notifications` と API `/api/me/messaging/preferences`、`dependsOn: ["pageMypage"]`、既定 閉）。閉の間ページと API は 404。表 `message_preferences` とワンクリックの受け口は門に関わらず開（domains は持たない）。住所の定数は `constants/preferences.ts`
- 形 = 経路（有効な経路の受け口、`enabled: false` は出ない）> 種別の枠（利用者が止められる種別 = 性質 `userStoppable` の activity・marketing、`MESSAGE_KINDS` の順）> グループ（受け口 `categoryGroups`、グループの無い種類は `key` null の 1 つで見出しのグループより先、見出しは `order` の順。D82）> 種類（D60・D62）。経路に出る種類 = 種類の経路にその経路がある（列 = 種類の経路 ∩ 開いている経路、D86）。種類の無い経路は `kinds` が空
- 種類とグループの受け口は初めて使う時に `validateMessageCategories` で確かめる（誤りは投げる。生成の時の `pnpm check extensions` と同じ検査）
- 種類ごとの `optedOut` は送る側（`checkStops` = `findOptOuts`）と同じ判定: そのマス・種類の `'*'`・種別まるごと・経路の `'*'`・全体 `'*' '*'` のどれかの行で止まる。`via`（`cell` / `category` / `kind` / `channel` / `all` / null）はどの行で止まっているか（この順で先に当たった物）
- 経路ごとに `hasAddress`（経路の自前の引き方 `resolveAddresses`、無ければ端末の帳簿の有効な行 = 送る側の展開と同じ）と `connectHref`（経路の項目の宣言。サイト内の住所は門で閉じていれば null）。上流は line だけが持つ（LINE の連携の入口 `/api/auth/line/login?redirect_after=<好みのページ>`）。email・inApp は連携の画面が無いので持たない
- `GET` 表（`MessagePreferencesDto` = `{ allOptedOut, categories[{ key, optedOut }], kinds[{ kind, optedOut }], channels[{ key, label, hasAddress, connectHref, optedOut, kinds[{ kind, groups[{ key, label, categories[{ key, label, description, optedOut, via }] }] }] }] }`、型は `services/server/preferences/dto.ts`）/ `PATCH` `{ category, channel, optedOut }` か `{ kind, optedOut }` → 変えた後の表。止める = 行を足す（既にあれば何もしない）、再開 = その行を消す
- GET の広い停止の状態: `allOptedOut`・`categories[{ key, optedOut }]`（種類まるごと、種類ごとに 1 つ）・`channels[].optedOut`（経路まるごと）・`kinds[{ kind, optedOut }]`
- 広い行の下で 1 マスを再開すると 1 つの transaction で書き分ける（和、許可の行は無い）: 種別まるごと → 同じ種別のほかの種類の種類まるごと + この種類のほかの経路のマス / 種類まるごと → この種類のほかの経路のマス / 経路まるごと → その経路を持つほかの種類のマス。全部の行は書き分けない（via all で止まったまま）。経路まるごと・種別まるごとの書き分けは今ある種類の行だけを書く（後から足す種類はその人に止まらない）
- 種別まるごと（`kinds`、`{ kind, optedOut }`）: 上流の既定の画面はスイッチを出さない（D62）。fork は hook の `setKind` で部品を置ける。種別まるごとの行がある人が種別 X の種類の 1 マスを再開すると、1 つの transaction で種別の行を消し、X のほかの種類は種類まるごとの行、その種類のほかの経路（種類の経路の全部）はマスの行に書き分ける（D71）
- 退会: user の後片付けの項目 `cleanupHandlers/messagingPreferences.ts`（required）が本人の行を全部消す（D38。利用者の削除は FK の cascade でも消える）

### 通知の設定のページ（`/mypage/account/notifications`）

- client: `services/client/preferenceClient.ts`（`getMessagePreferences` / `setMessagePreference`、axios + `normalizeHttpError`）
- hook `useMessagePreferences({ enabled? })` → `{ preferences, isLoading, error, retry, setCell(category, channel, receive), setCategoryWide(category, stop), setChannelWide(channel, stop), setAll(stopAll), setKind(kind, stop), pendingKey }`。`preferences` は応答の入れ子のまま。変更の応答（変えた後の表）を SWR のキャッシュに書く（取り直さない）。`pendingKey` = 変えている最中の行 `<種類>:<経路>`（種類まるごと `<種類>:*`・経路まるごと `*:<経路>`・全部 `*:*`・種別まるごと `kind:<種別>`）
- 既定の画面（入れ物 `components/MessagePreferences`、`emptyText?`）の並び: 上に「すべての連絡を止める」→ 経路の枠（経路まるごとの切り替え・宛先の無い経路は連携の案内）→ 種別の枠（見出しだけ、種別のスイッチは出さない。D62）→ グループの見出し（グループの無い種類は見出し無しで先）→ 種類の行（その経路の 1 マス）。種類まるごと（すべての経路）の切り替えは、その種類が最初に出る経路の行に 1 回だけ置く
- 広い行で止まる種類の行は切で理由を出す。種類・種別・経路まるごとの下は押せて、入にするとサーバーが書き分ける。全部の停止の下だけ押せない（全部の間は経路・種類まるごとの切り替えも押せない）
- 種別の枠の表示名は `constants/kindLabels.ts` の `MESSAGE_KIND_LABELS`（仮。見直しは後の回）
- 部品（core_ui、props だけ、入口だけを import。fork は差し替えの Screen でこれと hook を組む）: `components/common/PreferenceChannelSection`（経路の枠: 題・経路まるごと・連携の案内・children）・`PreferenceKindFrame`（種別の見出し・children）・`PreferenceGroupHeading`（グループの見出し、null は描かない）・`PreferenceCategoryRow`（1 つの経路の 1 つの種類の切り替え・理由・children に行の操作。理由の文は `preferenceViaReason`）・`PreferenceCategoryWideToggle`（種類まるごとの切り替え）。経路の枠と種類まるごとは `stoppedByAll?`（応答の `allOptedOut` を渡す）で、全部を止めている間は行の値によらず止まった状態で見せて押せなくする（全部を戻すと行の値に戻る）。種別まるごとを出す fork は hook の `setKind` と `preferences.kinds` で自分の部品を置く
- ページ: `page.tsx` の 1 行スイッチ → `_screen/MyPageAccountNotificationsScreen.tsx`（題「通知の設定」+ `MessagePreferences`、mypage の layout が UserPage を巻く）+ `_screen/loader.ts`（access authenticated、門が閉なら notFound）
- マイページのカード: `src/features/core/user/mypageMenu/items/notifications.ts`（order 25「通知の設定」）。門が閉の間は棚の Link が描かない

## 配信停止の受け口 /api/messaging/unsubscribe と確認のページ /unsubscribe（常に開・門なし）

- トークン = base64url(JSON {v:1, r, c, ch, a?, mk?, d?}) + . + HMAC-SHA256(MESSAGING_UNSUBSCRIBE_SECRET)。`mk` = 送った連絡の鍵・`d` = 送った回の id（送る口が宛先ごとに入れる。後から足したので、無い前のトークンも同じ版で通り、結び付きは null）。`services/server/unsubscribe` の signUnsubscribeToken / verifyUnsubscribeToken / isUnsubscribeConfigured。引数の名前は `token`（API とページで同じ、`UNSUBSCRIBE_TOKEN_PARAM`）
- 住所は 2 つ: One-Click の POST の先 = `buildUnsubscribeUrl`（getAppBaseUrl() + /api/messaging/unsubscribe?token=、List-Unsubscribe のヘッダ。RFC 8058 のメールソフトはここへ POST する）/ 人が開く確認のページ = `buildUnsubscribePageUrl`（getAppBaseUrl() + /unsubscribe?token=、メールの本文のリンク）。メールの項目はヘッダの URL から `unsubscribePageUrlOf` で同じトークンのページの URL を作る（好みのページが開いていれば本文のリンクはそちら）
- 止めるのは POST だけ（RFC 8058 のワンクリックと確認のページのボタン、ログイン不要）。JSON を返す（`{ ok: true }`、トークンの誤りは 400 `{ ok: false, error: "invalid_token" }`）。HTML は返さない（GET は下の 303 だけ）。止める行: user:<id> → message_preferences（種類 × 経路、source one_click）、addr:<hash> → message_suppressions（reason one_click、scope = 種類）。何度届いても同じ。トークンの誤りは 400
- 停止を連絡・回に結ぶ: どちらの行にも `source_message_key`・`source_dispatch_id`（トークンの mk / d）を書く。好みのページからの停止・前のトークン・バウンスなどの停止は null（集計の「結び付き無し」）。同じ行が既にあれば書き換えない（最初の停止の出どころが残る）。`source_dispatch_id` は FK を持たない（回は保持の掃除で消えるが、停止の行は残す）
- 確認のページ `/unsubscribe`（`src/app/(user)/(public)/unsubscribe/`、`page.tsx` の 1 行スイッチ → `_screen/UnsubscribeScreen.tsx` + `_screen/loader.ts`、access public、門の外で常に開く D90）: loader がトークンを確かめ（`describeUnsubscribeToken` = 止める種類と経路の表示名、書き込みなし）、入れ物 `components/Unsubscribe` が確認（部品 `UnsubscribeConfirm`）→ hook `useUnsubscribe(token)` の `submit`（client `postUnsubscribe` = API の POST）→ 結果（部品 `UnsubscribeResult`: 止めた + 通知の設定への案内（門で閉じていれば棚の Link が描かない）/ リンクが正しくない）。見た目は fork が `_components/` の Screen で差し替える
- `GET /api/messaging/unsubscribe?token=…`（List-Unsubscribe のヘッダの URL を人が開いた時、One-Click に対応しないメールソフト）: 止めずに同じトークンのまま確認のページ `/unsubscribe?token=…` へ 303（`unsubscribePageUrlForToken`、起点は `getAppBaseUrl()`）。トークンは確かめない（誤りはページが見せる）。止めるのは POST だけ
- 古い `GET /api/messaging/unsubscribe?t=…` のリンクを新しいページへ移す口は作らない（GET は `?t=` を運ばない）（D42。引数の名前も `t` から `token` に変わった）
- 鍵 MESSAGING_UNSUBSCRIBE_SECRET は pnpm ops setup env が乱数で作る（既にある env ファイルにも足りなければ足す）。変えると送ったメールの停止のリンクは無効になる

---

## provider の webhook と計測の門

D36・D44。受け口は 1 本 `POST /api/webhook/messaging/[channel]/[provider]`（`createApiRoute` public。門なし = 常に開）。例: `/api/webhook/messaging/email/resend`・`/api/webhook/messaging/email/sendgrid`。

- 生の本文で経路の項目の `webhooks[provider].verify` → `normalize`（経路の事件 `ChannelWebhookEvent`）→ `services/server/webhooks` が当てる。知らない経路・provider は 404、鍵（env）が無ければ 503、署名の誤りは 401、当てる処理の誤りは 500（provider が送り直す）
- メールの項目: Resend（`RESEND_WEBHOOK_SECRET`）と SendGrid（`SENDGRID_WEBHOOK_PUBLIC_KEY`）を lib/mail/webhooks の検証と正規化で並べる。送る時に配達の id を provider のタグ（`delivery_id`。Resend tags・SendGrid custom_args）で渡し、事件の `deliveryId` で読み戻す
- 経路の事件の種類（メール）: `sent` / `delivered` / `deferred` / `bounced_hard` / `bounced_soft` / `complained` / `opened` / `clicked` / `dropped` / `unsubscribed` / `other`
- 当て方:
  - `message_events` に `UNIQUE(provider, provider_event_id)` で一度だけ入れる（provider の元の事件を `payload` に残す。30 日で消える。HTTP では返さない）
  - 配達の行は provider の message id で引き、無ければタグの配達の id
  - 状態は前にだけ進める（queued < sending・unknown < sent < delivered < bounced・failed。遅れて届いた古い事件で戻さない）。時刻（`delivered_at`・`failed_at`・`opened_at`・`clicked_at`・`complained_at`）は最初の 1 回だけ。`suppressed`・`canceled` の行の状態は変えない
  - `bounced_hard`・`complained` → `message_suppressions`（reason `hard_bounce` / `complaint`、scope `'*'`、source `webhook:<provider>`）。`bounced_soft`（Resend の Transient・Undetermined、SendGrid の blocked）は停止しない。`dropped` → `failed`
  - `unsubscribed`（provider の仕組みの停止）は記録だけで好みに書かない（provider の一括停止は使わない、D35）
- 計測の機能 `messagingTracking`（`src/featureGate/rules/messagingTracking.ts`、既定 **閉**、住所・ドメインなし）: 閉の間、`opened`・`clicked` は記録も反映もしない。開ける fork は provider 側の開封・クリックの計測も入れる（秘密を差し込む連絡は計測しない、D33）

---

## 受け取り箱（利用者の API /api/me/messaging/inbox）

D18・D32。`createMeRoute`（本人に束ねる。機能の門は持たない = 常に開、D57）。中身は `services/server/inbox`。

- `GET /api/me/messaging/inbox?cursor=&limit=&unreadOnly=` → `{ items: InboxItemDto[], nextCursor }`（公開の時刻・id の降順の keyset。`limit` 既定 20・最大 50。`unreadOnly=true|1`。`cursor` は前のページの `nextCursor`、形が正しくなければ 400）
- `GET /api/me/messaging/inbox/unread-count` → `{ count }`
- `POST /api/me/messaging/inbox/[id]/read` → `{ ok: true }`（見える行だけ。見えない行・無い行は 404）
- `POST /api/me/messaging/inbox/read-all` → `{ ok: true }`
- `InboxItemDto` = `{ id, title, body, link, image, metadata, publishedAt (ISO), read }`。回の中身（宛先・数・記録）と他人の情報は返さない。`image` は保存した値のまま（`storage://` の ref か URL）で、表示の部品（`AppImage` が内部で `toStorageDisplaySrc` 相当の解決をする）が表示用にする

見える行（規則は `inbox/visibility.ts` の 1 か所。SQL と、テスト用の同じ判定）:

- 公開の時刻 ≤ 今
- 自分宛ての行（`user_id` = 見る人）か、共有の行（`user_id` null で `target_roles` が null = 全員 か 見る人のロールを含む）
- 共有の行: 回の `show_to_later_signups` が false なら、見る人の登録（`users.created_at`）より前に公開された行は見せない（利用者の行が無ければ見せない）
- 共有の行: 好みに従う回（種別の性質 `userStoppable`、kind の無い前の回も）で、見る人が inApp か `'*'` の経路で回の `category` か `'*'` を止めていれば見せない（共有の行は書く時に好みを当てないので読む時に当てる）
- 取り下げた回の行は消えている（`retracted_at` は回にだけ残る）

既読: `message_inbox_reads` の行がある か 公開の時刻 ≤ `message_inbox_read_states.read_watermark_at`。全部既読は 1 つの取引で watermark を今に進め、公開の時刻 ≤ 今の自分の個別の既読の行を掃く（watermark が覆うので既読のまま）。

受け取り箱の画像と保存の台帳（`inbox/imageBinding.ts`・台帳の口 `inbox/imageBindingLedger.ts`）:

- 持ち主は回: 台帳の紐付け = `messaging.dispatch` / 回の id / `inApp.image`（用途 `notification.image`）。受け取り箱の行ではない理由: 台帳の 1 つのファイルは 1 つの業務行にしか結べず、宛先ごとの行は同じ画像を指す（行ごとに持たせると宛先の数だけ複製と strip の描き直しが要る）。宛先ごとの行は利用者の削除の cascade でも消える。受け取り箱の行は回より長生きしない（FK cascade。保持の掃除はお知らせの行の無い回だけを消す）ので、回を消す時に外せば全部の道を覆う
- 結ぶ: お知らせの行を書く前、回の行を排他で持った取引の中で（共有の行 = 展開の `store.expandOne`、宛先ごとの行 = inApp の経路の `bindImages`）。`storage://` でない値（固定の URL）は結ばない
  - 回の actor が上げた未紐付けの `notification.image` の画像 → そのまま回に attach
  - 別の人が上げた・他の業務行に結ばれた・用途の違う画像 → 回ごとに 1 回 copy（持ち主なし）して複製を attach（coupon の `issueCodeForOwner` と同じ。元と ref を共有しない）。複製の失敗は投げる（黙って画像なしにしない）
  - 対応 `{ <元の参照>: <結んだ参照> }` を回の `metadata.inboxImages` に残し、束・送り直しは同じファイルを使う
- 外す: 保持の掃除が回を消す取引の中で `metadata.inboxImages` の値を detach（`record_removed`）。保持の掃除を通らずに回が消えた（手作業の DELETE など）画像は、storage の照合（cron storage-sweep）が有無の関数 `existingDispatchIds`（`inbox/dispatchRecords.ts`。回の行がある = 残す、無い = 外す）で外す（task.ts が `recordResolvers` に渡す）。取り下げ（S3、行を消して回は残す）は画像を回に結んだまま残し、保持の掃除が回を消す時に外れる
- 写した前のお知らせ: S2 の写しが古い紐付けを写した回（`messaging.dispatch` / 同じ id / `inApp.image`）へ付け替え済み（下の「写した前のお知らせ」）

静かな行: `metadata.silent = true` の行（前のお知らせの `is_silent` を写した行）は、未読の数（`unread-count`）と未読だけの一覧（`unreadOnly`、未読のモーダル）に入れない。ふつうの一覧には出す（規則は `inbox/readState.ts` の `inboxSilentSql` / `isSilent`）。

### 受け取り箱の画面（client・部品・ページ /messages）

- client: `services/client/inboxClient.ts`（axios + `normalizeHttpError`）。一覧の応答は `@/hooks/cursorPage` の `CursorPage` と同じ形
- hook（`hooks/index.ts` から）:
  - `useInboxItems({ unreadOnly?, limit?, enabled?, revalidateOnFocus?, observerOptions? })` = `useInfiniteScrollQuery` のカーソルのモード。`total` は読み込み済みの件数（総数は数えない）
  - `useInboxUnreadCount({ enabled? })` → `{ count }`（SWR `INBOX_UNREAD_COUNT_KEY`）
  - `useMarkInboxItemRead()` → `markRead(id)` / `useMarkAllInboxRead()` → `markAllRead()`（`useDomainMutation`。成功で未読の数を取り直す。一覧の印は呼び手が `updateItems` で `read: true` にする）
- 部品（core_ui、入口だけを import）:
  - `components/common/InboxItemRow`（1 行。押すと `onOpen(item)`）・`InboxItemDetail`（1 件の中身。題は包む Modal が持つ）・`InboxUnreadMark`（未読の点）
  - 入れ物 `components/InboxList`（`unreadOnly?`・`limit?`・`emptyText?`）と `components/InboxUnreadModal`
- 一覧の流れ: hook `useInboxList(options)` → `{ query, unreadCount, opened, open, close, markAll, isMarkingAll }`（開く → 既読 → `updateItems`、全部既読 → `updateItems` + 知らせ）。入れ物 `InboxList` はこれと部品を並べるだけ
- 未読のモーダル: 入れ物 `InboxUnreadModal`（部品を並べるだけ）+ 流れの hook `useInboxUnreadModal({ enabled?, paths? })`（config・住所 `isInboxModalPath`（末尾 `*` で前方一致）・ログイン・確かめた印（sessionStorage）・古い順・見せたら既読・`next` / `skip`（全部既読）/ `close`）。上流の利用者の枠（`src/app/(user)/_layout/UserLayout.tsx`）が外枠の末尾に置く（fork の `UserLayout.replace` は既定の `UserLayout` を描けば付く。もう 1 つ置くと 2 重）。お知らせの機能（門 `messagingInbox`）が閉なら hook は何もしない（取りに行かない、`enabled` を渡しても）。`config.ts` の `inbox.showUnreadModal`（既定 true）= 門が開の間に出すか、`inbox.unreadModalPaths`（既定 `["/"]`）、上書きは `src/config/features/messaging.config.ts`
- ページ `/messages`（`src/app/(user)/(protected)/messages/`）: `page.tsx` の 1 行スイッチ → `_screen/MessagesScreen.tsx`（題「お知らせ」+ `InboxList`）+ `_screen/loader.ts`（access authenticated、閉なら notFound）。初めの一覧もサーバーでは取らない（入れ物が hook で取る）
- 門: 規則 `messagingInbox`（`src/featureGate/rules/messagingInbox.ts`、住所 `/messages`、既定 閉）。API と表は常に開（domains は持たない）。閉の間は枠の未読のモーダルも出ない。開ける fork は `src/config/featureGate/switches.config.ts`

---

## 管理の送信と回の読む口（/api/admin/messaging/**）

管理者だけ（API の access `roleCategories: ["admin"]` と service の `assertAdmin` の両方。service は監査の文脈の操作者の役割の分類を引き、runAsSystem の system も通す）。操作は監査ログに 1 行。機能の門 `messagingDispatches`（既定 開）が回の読む口・続きを送る（`/api/admin/messaging/dispatches`）と管理画面 `/admin/messaging` を持つ。一括送信 `bulk-send` は門に入れない（管理一覧の一括操作が使うので、画面を閉じても送れる）。

### 管理者が書いて送る連絡（種別ごとの authored の定義 3 本、D65・D80・D85・D92）

- 定義: `messages/adminAnnouncement.ts`（`messaging.adminAnnouncement`、カテゴリー `announcement`）・`messages/adminDirect.ts`（`messaging.adminDirect`、`operatorDirect`）・`messages/adminMarketing.ts`（`messaging.adminMarketing`、`marketing`）。`authored: true`（文面を送るたびに受け取る。定義は鍵と種類だけ、文面・vars は空、上書きのファイルは置けない）。種別 → 定義の表と選んだカテゴリーの検査は `services/server/admin/freeText.ts`（`ADMIN_FREE_TEXT_DEFINITIONS`・`adminFreeTextCategoryOf`）
- 送る時は選んだカテゴリーの種別の定義の鍵で、受けた文面を組む（`sendAuthored`。その場で書く連絡もテンプレートも同じ）。カテゴリーの種別が announcement・direct・marketing でなければ 400、宛先の種類（all・role・audience・users・bulk）は種別の性質 `adminFreeText` で確かめる（announcement = 全員・ロール・宛先の集め方・選んだ利用者 / direct = 選んだ利用者・一括 / marketing = 全部）。経路の制限は無い（カテゴリーの経路のどれにも文面を書けば LINE・fork の経路も送れる）
- 文面は経路ごとの欄の全部（メール = 件名・preheader・見出し・段落・ボタン・足元、お知らせ = 題・本文・画像・行き先、LINE = 文、fork の経路 = その欄）。**決まった挨拶・足元の文は無い**（前の「〜からのお知らせ」「〜様」・問い合わせの足元は無くなった。要るなら管理者が書く）。宛名 `{{displayName}}` は `enrichers/displayName.ts`（名前が無ければ「お客様」、3 本に当たる）。文面の `{{鍵}}` はテンプレートと同じく差し込む（知らない鍵は 400）
- 描き方はメールの経路の既定（段落は改行をそのまま）。fork は鍵ごとに `views/<名前>.tsx` を置いて替えられる
- これまでの回（`messaging.adminMessage`、定義は消した）は当時の鍵・種別・カテゴリーのまま一覧・詳細・集計で読める。再送は「回の連絡の定義を読めません」（`definition_missing`）で止まる

### 回の操作 `/api/admin/messaging/dispatches/[id]/{cancel, retract, resend}`（門 `messagingDispatches`）

D39・D42。service: `services/server/admin/operations.ts`（`messagingService.adminCancelScheduled` / `adminRetract` / `adminResendFailed`。service でも管理者を確かめる）。どの操作も回の行を `FOR UPDATE` で持った 1 つの取引（`admin/operationsStore.ts`）。できない操作は 409 と理由の符号（DomainError の `code`）

- `POST /cancel`（予約の取り消し）: 予約（`scheduled`）でまだ展開していない回だけ `cancelled`。他は 409（`not_scheduled` / `already_started`）。監査 `messaging.dispatch.cancelled`
- `POST /retract`（取り下げ）: 回のお知らせの行（全員・ロール宛ての共有の 1 行と受信者ごとの行）を消し、未送信の配達（`queued`）を `canceled`、宛先ごとの送り直しの予定も止め、回の展開も止めて（`expand_cursor` を終わりに）`retracted_at` を書く。**回の status は変えない**。送ったメールは取り戻せない（受け取り箱だけ）。お知らせの画像は保持の掃除と同じく台帳から外す。2 回目は 409（`retracted`）、予約のままの回は 409（`scheduled_use_cancel` = 取り消しを使う）、取り消した回は 409。戻す操作は無い。監査 `messaging.dispatch.retracted`（消した行・止めた配達・外した画像の数）
- `POST /resend` `{ includeUnknown? }`（失敗の再送）: required でない回の `failed` の配達だけ。`unknown`（送れたか分からない）は `includeUnknown: true` の時だけ含め、回の `metadata.possibleDuplicate` に二重の可能性を残す。履歴は `metadata.resends`
  - 本文を残す連絡（record `vars` / `full`）: 同じ回のまま配達の行を `queued` に戻す（attempts 0、冪等の鍵 = 配達の id のまま）。回は `processing` に戻り、最初の 1 束を続きを送るで送り、残りは cron。lease 中（`sending`）の行は触らないので cron と再送が同じ宛先を二重に送らない
  - record `meta` の連絡: 同じ回では送り直さず、回の vars（元の入力の写し、回に 1 組の値だけ）で失敗の宛先へ**新しい回**として送る（`metadata.resendOf`、テンプレートの回は同じ版）。送った配達の id は `metadata.resentDeliveryIds` に残して二度送らない。写しがもう無い（回を閉じた後）= 409（`no_input_copy`）
  - 409: 秘密を差し込む連絡（`secret`、秘密の値は残さないので送り手のコードからもう一度送る）・required（`required`）・定義を読めない（`definition_missing`）・取り下げ / 取り消し済み・予約のまま（`scheduled`）・失敗の宛先が無い（`no_failed`）
  - 監査 `messaging.dispatch.resent`（mode・failed / unknown の数・includeUnknown・新しい回の id）
- 回の 1 件（`GET /dispatches/[id]`）の `operations`: `cancel` / `retract` / `resend` ごとに `{ allowed, reason }`（resend は `mode`・`failed`・`unknown` も）。画面のボタンと service は同じ判定（`operationFlags`）
- 理由の符号と文は `constants/dispatchOperations.ts`（`DISPATCH_OPERATION_REASONS` / `DISPATCH_OPERATION_REASON_TEXT`）の 1 か所。service の 409 の文と画面の理由の行が同じ物を読む。画面は 409 の本文を読まず `operations` の `reason` を出す

### 管理の送信 `/api/admin/messaging/send/**`（門 `messagingBroadcast`）

- 門: 規則 `messagingBroadcast`（`src/featureGate/rules/messagingBroadcast.ts`、`dependsOn: ["messagingDispatches"]`、既定 閉、住所は API `/api/admin/messaging/send`、送るモーダルの口（回の一覧「新しく送る」・回の詳細「同じ内容で送る」）は部品が `useGate` で出し分ける）。閉の間 API は 404、口は出ない。一括送信（`/bulk-send/**`）はこの門の外。送る口と cron の予約の拾いは門に関わらず動く
- service: `services/server/admin/send.ts`（`messagingService.adminSend` / `adminSendPreview` / `adminSendEstimate` / `adminSendTest` / `adminSendOptions`）
- `POST /send`（`AdminSendInputSchema`）: 中身 = `content`（経路ごとの文面）・`template?` = `{ templateId, version }`（呼び出したテンプレート、読み込んだ今の公開版）・`vars?`（テンプレートの変数の値、`template` がある時だけ）。その場で書く連絡とテンプレートは `template` の有無だけが違う（D92、`sendAuthored`）・`category`（必須、種別 announcement・direct・marketing のカテゴリーの鍵）・`channels?`（カテゴリーの経路の中の絞り、省略 = 全部。その中に文面の無い経路があれば 400）・`audience` = `{ type: "all" }` / `{ type: "role", roles }` / `{ type: "audience", key, args? }`（audiences の受け口の項目）/ `{ type: "users", userIds }`（10,000 人まで）・`scheduledAt?`（ISO 8601、予約）・`idempotencyKey?`・`reason?` → `{ dispatchId, status, queuedCount, channelCounts }`。知らない鍵は 400。送り元 `messaging.adminSend`
  - **カテゴリーの種別と宛先の組は種別の性質 `adminFreeText`**（例: 運営からのご連絡 `operatorDirect` = direct は選んだ利用者宛てだけ）。誤りは service で 400（`admin/freeText.ts`、D80）。プレビューは宛先を見ない、テスト送信は選んだ利用者と同じ扱い
  - `channels?` は種類の経路の中の絞り（種類の外・空は 400、D86）
- `POST /send/preview`: 経路ごとに差し込みを済ませた欄と、経路の `preview` があれば描いた結果（メールは送る時と同じ描き方の HTML）。見本の受信者 = 操作した管理者。テンプレートは今の公開版（送る時に固定する版）
- `POST /send/estimate` `{ audience }` → `{ count, capped, fixedAtSend: true }`: 全員・ロールは数、audiences の項目は `count?(args)`、無ければ `resolveUserIds` を 10,000 まで数える（`capped`）、選んだ利用者は居る人の数。送る時に展開で数え直す（停止・宛先なしは引く前の数）
- `POST /send/test`: 宛先 = 操作した管理者だけ・`is_test`（集計と分母から外す）。予約しない。システムの操作（操作者なし）は 400
- `GET /send/options`: 有効な経路 `{ key, label }`・ロール・audiences の項目・公開したテンプレート（今の版の番号・種類・文言・変数）・`categories`（送れるカテゴリー `{ key, label, kind, channels, audiences }`）・`maxScheduleDays`
- 監査: `messaging.dispatch.sent`（今送る）/ `messaging.dispatch.scheduled`（予約）/ `messaging.dispatch.test_sent`（対象 `message_dispatch`、本文の値は残さない）

### 送るモーダル（`components/MessageSendModal`、D85・D87）

送る画面のページは無い（`/admin/messaging/send` はモーダルにたたんだ）。1 つの入れ物が 3 つの開き方で同じ hook を通る。fork は自分の画面（例 発送リクエストの一覧）にもそのまま置ける（公開の入れ物・部品・hook）。

- 入れ物 `MessageSendModal`（`mode`・`label?`・`triggerVariant?`・`disabled?`・`icon?`・`onSent?(result)`・`dispatchBasePath?`）: 開くボタンとモーダル（`Modal` の `confirmOnClose` = 書きかけのまま閉じる前に確かめる）。hook を呼んで部品を並べるだけ
  - `mode`: `{ type: "new" }`（回の一覧の「新しく送る」）/ `{ type: "sameAs", dispatch }`（回の詳細の「同じ内容で送る」。文面・カテゴリー・宛先の形を写す。本文を残さない回は件名・題だけで本文は空、テンプレートの回はそのテンプレートを今の公開版で呼び出す）/ `{ type: "bulk", target, recordIds, recordNoun, defaults?, defaultCategory?, source? }`（管理一覧の一括操作、`bulkMessageAction` が描く）
  - new・sameAs の口は門 `messagingBroadcast` が開の時だけ（置き場の入れ物 `AdminDispatchList` / `AdminDispatchDetail` が出し分ける）。bulk は門の外
- 流れ: テンプレートを呼び出す（門 `messagingTemplates` が開で公開中の物がある時だけ）→ 今の公開版の文言が書く欄に写る（画像の参照も。替える・外せる）。その場で書く時も同じ経路の欄で、カテゴリーの経路は全部（LINE・fork の経路も）。送る中身は空の任意の欄を落とした経路の欄（`contentForInput`）で、プレビュー・テスト送信・見込み・送る・一括送信が同じ物を使う → 直す → 宛先（全員・ロール・宛先の集め方・選んだ利用者 / bulk は選んだ記録）→ カテゴリー（宛先の種類で選べる物、D80）→ 経路の絞り（カテゴリーの経路の中、既定は全部オン）→ 文言の無い経路は空欄で見せて送る前に止める（サーバーの 400 と同じ線）→ 送る時刻（今 / 予約。予約の粒度の注記。bulk は予約なし）→ プレビュー・自分にテスト送信 → 確認へ（見込み = 宛先数、送る時に数え直す。bulk は選んだ記録の数）→ 送る → 結果（状態・回へのリンク・bulk は afterSend の成否）
- 部品（props だけ、`components/common/`）: `SendTemplatePicker`（選んで呼び出す・呼び出し中の名前と版）・`SendContentFields`（その場で書く時もテンプレートの時も経路の欄 `TemplateChannelFields` = メール 件名・プレヘッダー・見出し・段落・ボタン・フッター / お知らせ 題・本文・画像（上げる・替える・外す、用途 `notification.image`）・行き先 / LINE 本文 / fork の経路 欄の JSON。文言なしの印、変数の値はテンプレートの時だけ）・`SendAudiencePicker`（`kind: "select"` の宛先の選び / `kind: "bulk"` の選んだ記録の数）・`SendCategoryChannels`（カテゴリーと経路の切り替え）・`SendLegalNotice`（法の義務の告知はメールを経路に含める注意、D83。いつも出し、メールがオフなら警告の色。送るのは止めない）・`SendSchedule`（今 / 予約・注記・誤り）・`SendConfirmView` / `SendResultView`（確認と結果）・`MessagePreview`
- hook `useMessageSendModal({ mode, onSent? })`: 開閉・段（edit → confirm → done）・中身（`draft`: その場で書く / 呼び出したテンプレートの欄の写し）・宛先・カテゴリー・経路・予約・プレビュー・テスト送信・見込み → 確認・送る（new / sameAs = `POST /send`、bulk = `POST /bulk-send`、プレビューとテストも bulk は `/bulk-send/preview`・`/bulk-send/test`）・二重送信を防ぐ鍵（開くたびに 1 つ、送った後に作り直す）・`dirty`（`@/lib/unsavedGuard` でページの移動を確かめ、`closeConfirm` を Modal へ）。まだ触っていない欄の初めの値（sameAs の写し・bulk の既定）は state に入れず mode と選択肢から導く。選択肢は開いている間だけ取る（new / sameAs = `useAdminSendOptions`、bulk = `useAdminBulkSendOptions`）。`sameAsNote`（sameAs でテンプレートが今は公開中でない時の知らせ。書く段の上に出す）。純粋な関数 `scheduleErrorOf` / `templateVarsForInput` / `isBlankChannel` / `draftFromTemplate` / `initialDraftOf` / `initialAudienceOf` / `sameAsNoteOf`
- sameAs の写し: 宛先 = 回の形（全員・ロール・集め方はそのまま、選んだ利用者の回は `audienceUserIds` の同じ利用者、無ければ選び直し）/ 文言 = テンプレートの回は今の公開版で呼び出し、直して送った回（`templateEdited`）は直した文言を写す（送る口は今の公開版だけを受ける）。テンプレートが公開中でなければその場で書く形へ写し（メール・お知らせの欄に入る分）、`sameAsNote` で知らせる
- 経路の表示名: 送る・一括送信とも選択肢の経路の label（受け口の label。inApp = お知らせ）。選択肢を持たない所（回の絞り・配達の行・文言の上書きの欄）は `constants/channelLabels.ts` の `MESSAGE_CHANNEL_LABELS`（受け口の label と同じ値、テストで照合）

### `/api/admin/messaging/bulk-send`（一括送信）

- `GET`: 選択肢 `{ channels, categories, templates }`（channels = 送る画面の選択肢と同じ経路 `{ key, label }`、表示名は経路の受け口の label / categories = 一覧の一括 bulk で送れる種別のカテゴリー / templates = 門 `messagingTemplates` が開の時だけ公開中のテンプレート、閉なら空）

- `POST`: 宛先は `{ userIds }` か `{ target, recordIds }`（1 回 10,000 人まで）、中身は送る画面と同じ `content`・`template?`・`vars?`・`category`（必須、bulk で送れる種別）・`channels?`（カテゴリーの経路の中の絞り、文面の無い経路は 400）・`idempotencyKey?`（8〜128 文字）・`source?`（送り元、既定 `<target>.bulk`、userIds なら `messaging.adminBulk`）・`reason?`・`isTest?`。予約は無い（`scheduledAt` は 400）。知らない鍵は 400（前の形の `message` も）。検査は送る画面と同じ部品（`admin/send.ts`）
- `POST /preview`・`POST /test`: 送る画面のプレビュー・自分へのテスト送信と同じ（カテゴリーは bulk で送れる物、テストの送り元 `messaging.adminBulk.test`）。門 `messagingBroadcast` には入れない（一括送信と同じく管理一覧の一括操作から使う）
- 結果: `{ dispatchId, status, counts: { recipientCount, channelCounts, queuedCount }, afterSend: { ok: true } | { ok: false, error } | null }`。大きな送信の続きは cron が送る
- 受け口 `bulkSendTargets/<名前>.ts`（`export const bulkSendTarget: MessageBulkSendTarget`、型 `services/server/admin/types.ts`）: `key`・`label`・`enabled?`・`resolveUserIds(recordIds)`（選んだ記録 → 利用者 id）・`afterSend?({ recordIds, dispatchId, counts, content, template })`（送信の受け付けの直後に 1 回。`content` = 送った文面（経路ごとの欄、差し込む前の字。メールの件名は `content.email?.subject`）、`template` = `{ id, version, edited }`（その場で書いた文面は null）。投げても送信は戻らず結果と監査に失敗を残す）。上流の項目 `bankTransferReview`（振込審査 → 申告した利用者、メールを送ったら管理メモに「YYYY/MM/DD「件名」メール送付」）
- 監査: `messaging.dispatch.bulk_sent`（対象 = 回、metadata = 送り元・種別・経路・数・状態・対象の鍵・afterSend）

### 回の読む口（D37。汎用 CRUD の search に乗せない）

- `GET /api/admin/messaging/dispatches`: 条件 `from`・`to`（作った時刻）・`messageKey`・`kind`・`channel`・`status`・`cursor`・`limit`（既定 50、最大 100）→ `{ items: AdminDispatchSummary[], nextCursor }`（新しい順、keyset）
- `GET /api/admin/messaging/dispatches/[id]` → `AdminDispatchDetail`（「同じ内容で送る」が写す `templateEdited`・`templateContent`（直して送った回の文言、ほかは null）・`audienceUserIds`（選んだ利用者に送った回の利用者 id。回が宛先の一覧を持てばそこから、数だけの回は配達の行から。10,000 人を超える回・ほかの宛先の形は null）を含む）
- `GET /api/admin/messaging/dispatches/[id]/deliveries`: 条件 `status`・`channel`・`cursor`・`limit` → `{ items: AdminDeliveryRow[], nextCursor }`（古い順）
- 返す項目は `services/server/admin/dispatchDto.ts` 1 か所: 鍵・種別・種類・送り元・状態・経路・件名 / 題（headings）・数・送った人・時刻・テストかは常に、回の本文（rendered）と vars は記録の段が vars / full のとき、配達の vars は vars / full、配達の本文は full のときだけ、宛先は出す、provider の生の値（provider_message_id・事件の payload）と last_error の文は出さない（状態と reason の符号、失敗は last_error の符号の部分 `errorCode` で見る。文は `constants/deliveryErrors.ts`、画面の配達の行が「失敗の理由」に出す。例 `unsubscribe_key_missing` = 配信停止の鍵の env が無い）。前の送る口の回（message_key が null）は件名・題・本文を前の列から

### `POST /api/admin/messaging/dispatches/[id]/continue`（続きを送る）

- `continueSending`（1 束だけ進める。processing の回だけ、他は 409）→ `{ expanded, claimed, sent, failed, completed }`。監査 `messaging.dispatch.continued`

### 管理一覧の一括送信の作成関数（`components/AdminBulkSend`）

管理一覧の一括操作の受け口 `adminBulkActions` の項目を数行で作る（`@/lib/crud/components` の `bulk*Action` と同じ形。lib は features を読めないので messaging に置く）。項目の部品は送るモーダル `MessageSendModal` の bulk（門 `messagingBroadcast` の外）。対にサーバーの受け口 `bulkSendTargets/<名前>.ts` が要る（記録 → 利用者 id と afterSend はサーバーの項目だけが持つ。画面は鍵 `target` と選んだ id を送るだけ）。

```tsx
// src/features/<domain>/adminBulkActions/notify.tsx
import { bulkMessageAction } from "@/features/core/messaging/components/AdminBulkSend";

export const bulkAction = bulkMessageAction(
  { key: "notify", order: 100 },
  { target: "<bulkSendTargets の key>", recordNoun: "発送リクエスト", defaultCategory: "operatorDirect" },
);
```

- options（`BulkMessageActionOptions`）: `target`・`recordNoun`（文に入る名詞）・`label?`（既定「一括送信」）・`defaults?`（`{ content }` = 書く欄の初期値。送る中身と同じ形、経路の鍵 → 経路の欄。例 `{ content: { inApp: { title, body } } }`）・`defaultCategory?`（既定 `operatorDirect` = 運営からのご連絡、D81。選べなければ最初の物）・`source?`・`disabled?`・`onSent?(result)`（一括の結果。サーバーの afterSend とは別の画面の側の後処理）
- 流れは送るモーダルと同じ（テンプレートの呼び出し・プレビュー・自分へのテスト送信が使える、予約は無い）。送った後に `onSent` → `onDone`（選択を外し一覧を取り直す）
- 上流の使い手: `bankTransferReview/adminBulkActions/sendEmail.tsx`（target `bankTransferReview`、既定のカテゴリー operatorDirect）

### 利用者ごとの履歴（`messagingService.listUserMessageHistory`）

- `messagingService.listUserMessageHistory(userId, { cursor, limit })` → `{ items, nextCursor }`。その利用者の配達（1 行 = 1 経路）を回と結び新しい順
- 項目は `dispatchId`・`messageKey`・`kind`・`source`・`channel`・`status`・`headings`・`createdAt`・`sentAt`（本文・宛先・provider の値は出さない）
- server だけ・route なし・管理者を確かめない: 呼び手（fork の管理の service / route）が読める人を決める
- 出ない物: 全員・ロール宛ての受け取り箱の共有行、配達を持たない前の送る口の回、消した利用者の配達

### 送った回の管理画面（`/admin/messaging`、門 `messagingDispatches`、既定 開）

- `/admin/messaging`: 入れ物 `AdminDispatchList`（`initialFilters?`・`limit?`）= 絞り込み（期間・定義の鍵・種別（7 つ、`constants/kindLabels.ts` の順と表示名）・経路・状態。入力と「絞り込む」での確定は hook `useAdminDispatchFilters(initialFilters)`）+ 回の行（`common/DispatchRow`）の無限スクロール（カーソル）
- `/admin/messaging/[id]`: 入れ物 `AdminDispatchDetail`（`dispatchId`）= 回の中身（状態・件名 / 題・経路ごとの数・送った人・時刻・本文は記録の段しだい）+ 「続きを送る」（状態 processing の回だけ、ConfirmPopover）+ 配達（状態・経路で絞る、カーソル、`common/DeliveryRow`）。流れ（配達の絞り・`includeUnknown`・取り消す / 取り下げる / 再送 / 続きを送る と知らせ）は hook `useAdminDispatchDetail(dispatchId, { limit?, observerOptions? })`
- loader は認可だけ（`roleCategories: ["admin"]`）。データは hook（`useAdminDispatches`・`useAdminDispatchFilters`・`useAdminDispatchDetail`（中で `useAdminDispatch`・`useAdminDispatchDeliveries`・`useContinueDispatch` と操作の hook））
- 管理画面のページは 4 つ: 回の一覧 `/admin/messaging`・回の詳細 `/[id]`・テンプレートの一覧 `/templates`・文言の上書きの一覧 `/overrides`（作る・直す・送るはモーダル、D87）
- 管理メニュー: `src/features/core/admin/menu/items/messagingDispatches.ts`（マーケティング > 送信の履歴）
- 送るモーダルの口: 一覧の上に「新しく送る」、1 件に「同じ内容で送る」（`MessageSendModal`、門 `messagingBroadcast` が開の時だけ）
- 回の操作（部品 `common/DispatchOperations`、props だけ）: 予約を取り消す・取り下げる・失敗分を再送 のボタン。できない操作は押せず `operations` の理由を出す。押すと確認の Dialog（取り下げは戻せない・送ったメールは取り戻せない、再送は 同じ回で / 新しい回として と失敗・不明の数、不明がある時だけ「不明も含める」= 二重に届くおそれ）。入れ物 `AdminDispatchDetail` が hook `useCancelDispatch` / `useRetractDispatch` / `useResendDispatch`（成功で回と一覧を取り直し、配達の一覧も取り直す）をつなぐ

## 購読（subscribers・cron messaging-subscribers）

D47。送った後の事件を fork のコードが受ける口（events = outbox）。管理の一括送信の `afterSend`（送信の直後に 1 回）とは別。

- 項目: `messaging/subscribers/<名前>.ts` に `export const subscriber: MessageSubscriber = { key, on, filter?, handle }` → `pnpm generate extensions`。上流の項目は無い（受け口だけ）
  - `on`: 受ける事件の種類。内部の事件 `dispatch.completed`・`delivery.sent`・`delivery.failed`・`delivery.suppressed` と、webhook の事件の種類（`delivered`・`bounced_hard`・`opened` など、経路の正規化した語彙）
  - `filter?`: `{ messages?: 連絡の鍵[], channels?: 経路[] }`
  - `handle(events)`: 事件の束（`MessageEvent` = `id`・`type`・`messageKey`・`dispatchId`（照合できなかった webhook は null）・`deliveryId`・`channel`・`occurredAt`・`payload`）。**少なくとも 1 回**渡るので、事件の `id` と購読の鍵で冪等にする。投げると印を進めず次の実行でもう一度渡る
- 内部の事件: 元の状態の更新（配達の行・回の行）と同じ取引で `message_events` に書く（provider `internal`、`provider_event_id` は事件ごとの uuid）。**書くのは登録した購読のどれかが聞いている種類だけ**（購読が 0 なら何も書かない）。書く所: 小さな送信（止めた行 = suppressed、送った結果、要求の中で閉じた回）・cron の展開（止めた行）・送信（sent / failed / 送る直前に止めた行）・回を閉じる（`dispatch.completed`、payload `{ status, isTest }`）。宛先が複数で前の実行で sent になった行はもう一度 `delivery.sent` を書かない。lease を失った処理は行も事件も書かない
- webhook の事件にも配達から `dispatch_id`・`message_key`・`channel` を写す
- cron `messaging-subscribers`（5 分ごと、`services/server/subscribers`）: 購読ごとの印（`message_subscriber_cursors.last_seq`、前進は GREATEST で単調）から `seq` 順に、`created_at` が now − `subscribers.lagSeconds`（既定 120 秒）より前の事件だけを読み、`on` と `filter` に合う事件を `batchSize`（既定 100）ずつ `handle` へ。成功で印を進める。`runBudgetedBatches` + 締切（`budgetMs`）
  - lag の訳: `seq` は insert の順で commit の順ではない。lag より長く commit が遅れた取引の事件は飛ぶことがある（普通の取引は数秒）
  - 束が失敗したら 1 件ずつ渡し直し、それより前の事件は済み、失敗した事件で印を止める（`message_subscriber_failures.attempts`++、`last_error`）。同じ事件が `maxAttempts`（既定 5）回失敗したら隔離（`quarantined_at`）して印を進める
  - 合う事件を読み切ったら、合わなかった事件も含め上限（lag より前の一番大きい seq）まで印を進める（保持の掃除を止めない）
  - 隔離した事件の渡し直し（運用）: `reprocessQuarantinedEvents(購読の鍵, 事件の id?)`（成功で失敗の行を消す、失敗は隔離のまま数える）。隔離の行を見る画面は無い
- 保持: 事件の保持（`retention.eventsDays` 30 日）は、購読がある時、一番遅い購読の印より新しい事件を消さない（印の行がまだ無い購読 = 0）。隔離の行は事件と一緒に消える（FK cascade）
- 値（`config.ts` の `subscribers`）: `lagSeconds` 120 / `maxAttempts` 5 / `batchSize` 100 / `budgetMs` 240000

## cron（送信の掃き出し・保持の掃除）と続きを送る

送る口が要求の中で送り切らなかった分は cron が送る。機能の門は持たない（送る口と同じく常に開）。

- `messaging-send-sweep`（`* * * * *` UTC、毎分）: 1 回の実行で次を順に行う（予算 `sweep.budgetMs`）
  1. `sending` のまま lease（`locked_until`）が切れた配達の行を `unknown` にする（落ちた処理の痕跡。自動で送り直さない）
  2. 予約の時刻（`scheduled_at`）が来た `scheduled` の回を `processing` にする
  3. 大きな送信・audience の回を再開の位置（`expand_cursor`）から 1 束ずつ展開する（`sweep.expandChunksPerRun` 束まで）。`expand_cursor` = null（まだ）/ keyset の印か `i:<番号>`（途中）/ `MESSAGE_EXPAND_DONE`（`"~done"`、終えた。小さな送信は最初から）
  4. `next_attempt_at <= now` の配達の行を lease で取り（`FOR UPDATE SKIP LOCKED` で `sending` + `locked_until` + `lock_token`、並走する実行と重ならない）、回の定義（生成の一覧の `message_key`）から描き直して経路の send へ渡す。書き込みは `lock_token` が合う時だけ。`transient` は `transientRetry` の間で送り直し、尽きたら `failed`。複数の宛先は一時の失敗の宛先だけを送り直す
  5. 展開を終え `queued` / `sending` / 送り直し待ちの行が無い回を閉じる: `channel_counts` の sent / failed を数え直し、`completed` / `completed_with_failures`、`record: "meta"` なら送るために置いた `vars` を消す
- 定義が生成の一覧に無い・検査に落ちる回の行は `failed`（`definition_missing` / `definition_invalid`）。経路の項目が無ければ `suppressed` + `channel_off`
- 続きを送る: `messagingService.continueSending(dispatchId)` が 1 つの回を 1 束だけ進める（展開 1 束 + 送る 1 束 + 閉じられるなら閉じる）。`processing` 以外は 409。管理の API・画面は管理の指令
- **Vercel Hobby では cron が 1 日 1 回**（`pnpm generate cron -- --plan hobby`）。送信は遅れるだけで壊れない（最初の束は要求の中、残りは翌日か管理の「続きを送る」）。遅れの上限は保証しない。送信を使うなら毎分の cron（Pro か外のスケジューラから `pnpm task --due`）を勧める
- `messaging-retention`（`45 18 * * *` UTC、毎日）: `retention` の日数を過ぎた行を `FOR UPDATE SKIP LOCKED` の束で消す。事件 30 日 / 配達 90 日（`queued`・`sending` は残す）/ 回 730 日（お知らせ `message_inbox_items` が参照する回と `processing`・`scheduled` の回は残す。消す前に `idempotency_key` を `message_idempotency_keys` へ移し、回に結んだお知らせの画像を台帳から外す（同じ取引、結果の `detachedImages`。実物は commit の後に消す）→ 送る口の重複の確かめは両方の表を見る）/ 移した鍵は `idempotencyKeyDays`（既定 null = 無期限）

生の SQL（`sql```）に JS の Date を渡さない（Postgres が読めず落ちる）: ISO の文字列 + `::timestamptz` で渡すか、Drizzle の演算子（`lt` など。Date をそのまま受ける）を使う。生の SQL の組み立ては db を持たないファイル（`sweep/retentionSql.ts`・`inbox/cursorSql.ts` など）に置き、`services/server/rawSqlParams.test.ts` の一覧に 1 行足す（値に Date が混ざると落ちる）

処理の値: `sweep` { `budgetMs` 240000・`deliveryChunkSize` 100・`expandChunksPerRun` 20・`leaseSeconds` 300 } / `retention` { `eventsDays` 30・`deliveriesDays` 90・`dispatchesDays` 730・`idempotencyKeyDays` null・`chunkSize` 1000・`budgetMs` 240000 }

---

## 新しい連絡の基盤の表（定義だけ。使う側はまだない）

新しい送る口・配達・受け取り箱のための表。今は定義と schemaRegistry への登録だけで、読み書きするサービス・API・cron はまだない（後の段で足す）。

- `message_dispatches`（同じ表に列を追加）: `message_key`・`template_id` / `template_version`（版の固定）・`template_edited`（既定 false、テンプレートを呼び出した回で版の文面から直したか）/ `authored_content` jsonb（管理者が書いて送った文面、書いた文面の回だけ）・`kind` / `category`・`audience` jsonb・`tags`・`scheduled_at`・`channel_counts` jsonb（`{<経路>: {targeted, sent, failed, skipped_no_address, skipped_throttled, suppressed}}`）・`headings` / `vars` / `rendered` jsonb（経路が受け口なので経路を鍵にする）・`record`（meta / vars / full）・`show_to_later_signups`（既定 false）・`retracted_at`・`is_test`（既定 false）・`updated_at`・`expand_cursor`（展開の再開位置、cron の節）。古い列はそのまま（次の段で落とす）。`status` の値は `scheduled / processing / completed / completed_with_failures / cancelled` に広げた（列は同じ）
- `message_deliveries`: 受信者 × 経路 の 1 行。`UNIQUE(dispatch_id, channel, recipient_key)`。lease は `locked_until` + `lock_token`、送り直しは `next_attempt_at`。複数の宛先は `targets` jsonb。利用者を消すと `user_id` は null（`recipient_key` は残る）。`throttle_key`（間引きの鍵、索引 `(throttle_key, sent_at)`）
- `message_events`: provider の事件と内部の事件（追記だけ）。`UNIQUE(provider, provider_event_id)`。`seq`（入った順）・`dispatch_id`（回を消すと一緒に消える）・`message_key`・`channel`（購読の節）
- `message_inbox_items`: お知らせ。全員・ロール宛ては `user_id` null の共有の 1 行（`target_roles` null = 全員）、個人宛ては受信者ごとの行。回を消すと一緒に消える（取り下げはこの行を消す）。間引きの `throttle_key`・`collapsed_count`（既定 1）・`collapsed_dispatch_ids`（索引 `(user_id, throttle_key)`）
- `message_inbox_reads` / `message_inbox_read_states`: 個別の既読と全既読のウォーターマーク（notification_reads / notification_read_states と同じ形）
- `message_templates` / `message_template_versions`: 保存されたテンプレートと版（文言 `content`・変数・種類だけで経路の列は無い。版は追記だけ、`UNIQUE(template_id, version)`。読み書きは「保存されたテンプレート」の節）
- `message_preferences`: 利用者が止めた 種類 × 経路（止めた時だけ行、全体は `'*'`）と種別まるごと（`kind`、NOT NULL 既定 `'*'` = 種別まるごとではない）。`UNIQUE(user_id, category, channel, kind)`（素の列の uniqueIndex `uq_message_preferences_user_category_channel_kind`。NULL と NULLS NOT DISTINCT は drizzle-kit の push が往復しないので使わない。書き込みの衝突の先も 4 列 = `MESSAGE_PREFERENCE_CONFLICT_TARGET`）
- `message_suppressions`: 宛先の停止（`address_hash` = 正規化した宛先の sha256）。`UNIQUE(channel, address_hash, scope)`、`scope` `'*'` = 全種類
- `message_endpoints`: 端末の帳簿（利用者 × 経路 × 宛先）。`UNIQUE(channel, address)`
- `message_idempotency_keys`: 保持の cron が回を消す時に冪等の鍵を移す先（回の行は消えるので FK なし）

値の一覧（状態・理由）と jsonb の zod は `entities/schema.ts`、行の型は `entities/model.ts`。

---

## 写した前のお知らせ（S2 の写し。task と古い表は S3 で消した）

前のお知らせの表（`notifications`・`notification_reads`・`notification_read_states`・`notification_templates`）は S2 の 1 回きりの写し（`pnpm task messaging:copy-legacy-notifications`、notice `20261111-143012-messaging-switch` の区切りにだけある）で新しい表へ移し、S3（notice `messaging-drop-legacy`）で task・古い表・`message_dispatches` の古い列 7 つを消した。写しの手順と照合はその区切りの版のこの README にある。DB に残る写した行の形:

- お知らせ 1 行 = 回 1 つ: `source` `legacy.notification`・`tags` `['legacy']`・`message_key` null・`status` completed・`expand_cursor` `'~done'`（cron は拾わない）・`metadata.legacyNotificationId`・`show_to_later_signups` false
- お知らせの行: 全員・ロール宛ては共有の 1 行、個人宛ては利用者ごとの行。`is_silent` は `metadata.silent = true`（静かな行）。画像は `metadata.inboxImages` に残る（保持の掃除が外せる）
- テンプレート: `key` `legacy-<古い id>`・`status` draft・版 1
- 集計の注意: 前の送る口で送ったお知らせは前の回の行（`message_key` null）も残るので、写した回と同じお知らせが 2 つの回に出る。analytics は `source` `legacy.notification` の回を受け取り箱の既読の数だけに使い、送信・到達の数には入れない

---

## 運用で間違えやすい線（D77）

仕組みが線を引いた所。どれも「できない」ではなく「別の書き方で表す」。定義の側の書き方（種類が種別と経路を持つ・付け替えない・粒）は src/lib/messaging/README.md の同じ名前の節。

### 経路はカテゴリー（種類）が決める

- 設計の意図: 配信停止の単位は種類 × 経路（D35）。経路が回ごと・連絡ごとに変わると、利用者が切ったマスと実際に届く経路がずれ、好みのページの表が嘘になる。だから経路は種類 1 か所が持ち、属する連絡は全部その経路で届く（D86）
- どう書くか: 経路を変えたい = 種類の経路を変える（上流の種類なら `categories/<名前>.override.ts` の `channels`、functional・security は email を外せない `emailFixed`）。1 本の連絡だけ別の経路で届けたい = 別の種類を足し、その連絡をそちらに属させる

```ts
// src/features/<domain>/categories/itemSoldInApp.ts(fork、お知らせだけで届けたい「出品した物が売れた時」)
import type { MessageCategory } from "@/lib/messaging";

export const category: MessageCategory = {
  key: "itemSoldInApp",
  label: "出品した物が売れた時(お知らせ)",
  kind: "activity",
  channels: ["inApp"],
};
```

### その回は経路を絞るだけ

- 設計の意図: コードから自動で送る連絡は経路を選ばない（`channels` を渡さない）。管理者が手で送る時だけ、種類の経路の中で絞れる（足せない、外は 400）。回にはその回に使った経路が残る
- どう書くか: 送る口の `channels?` は管理の送信（`/send`・`/bulk-send`）と送るモーダルの経路のスイッチだけ。経路の組ごとに送り分けたいなら、組ごとに種類を作る（例 `campaignMail` = email だけ、`campaign` = email + inApp）

### 種別とカテゴリーは付け替えず、止めて足す

- 設計の意図: 種別（7 つ）は止められるか・好み・住所の停止・記録の既定の性質を決め（`MESSAGE_KIND_TRAITS`）、種類は停止の単位と集計の軸。上書きで付け替えると、利用者が止めた行・集計の物差し・上流の検査（required・emailFixed）が知らないうちに変わる。だから上書きは `category` を変えられず、種類の上書きは `key`・`kind` を変えられない（D74）
- どう書くか: 上流の連絡を別の種類（別の種別）で送りたい = 上流の連絡を `messages/<名前>.override.ts` の `enabled: false` で止め、自分のドメインに自分の種類（`categories/<名前>.ts`）と自分の連絡（`messages/<名前>.ts`、`pnpm generate message`）を足し、送り手からそれを呼ぶ

```ts
// src/features/core/wallet/messages/expiredNotice.override.ts(fork: 上流の連絡を止める。上流の functional は止められない)
import type { MessageOverride } from "@/lib/messaging";

export const messageOverride = { enabled: false } satisfies MessageOverride;
```

### 機能の連絡（functional）は上書きで止められない

- 設計の意図: functional は機能に組み込まれた連絡（メールアドレスの確認・パスワードの再設定など）。止めると機能が壊れる（届かない確認のリンクで登録が終わらない）。だから種別の性質 `upstreamDisable` が false で、上書きの `enabled: false`・文言の上書き（`adminTextOverride`）・間引き・email を外すことは検査で止まる（D68）
- どう書くか: 文面を変えたい = `messages/views/<名前>.replace.tsx`（メールの描き方）か上書きの文言の欄（`content`、functional は管理画面の上書きは不可だが fork のファイルの上書きは可）。流れごと替えたい = 送り手（auth など）の側の口を替える（その時は上流の連絡は呼ばれない）

### 種別まるごとの停止はデータだけ

- 設計の意図: 種別まるごとの行（`message_preferences` の `kind` X、`'*'` `'*'`）は fork が後から足す種類にも当たる広い停止。上流の既定の画面はスイッチを出さない（どの種別を利用者に見せるかは fork の判断、D62）が、送る口・受け取り箱・好みの見え方は同じ判定でこの行を見る（D71）。会員登録で宣伝に同意しなかった人は marketing の種別まるごとの行（source `signup`）
- どう書くか: 見せたい fork は hook `useMessagePreferences` の `setKind(kind, stop)` と `preferences.kinds` で自分の部品を置く。サーバーから書くなら `messagingService.setMessagePreference(userId, { kind, optedOut }, { source })`

### グループは見出しだけ

- 設計の意図: グループ（`categoryGroups/`）は好みのページで種類を束ねる見出し。止める単位ではない（D82）。グループで止められると、後から種類を足した時に止めた人に届くかが決まらない
- どう書くか: 種類の上書き・自分の種類で `group` を付ける（同じ種別の種類だけ）。まとめて止めさせたいなら、まとめる物を 1 つの種類にする（粒の線は src/lib/messaging/README.md）

### 法の義務の告知はメールを経路に含める（D83）

- 設計の意図: 届かなかった人の一覧は専用の口を作らず、回の配達を状態で絞って出す。全員・ロール宛てのお知らせ（inApp）は共有の 1 行で配達の行を持たないので、誰に届かなかったかを数えられない
- どう書くか: 法の義務で必ず届ける告知（規約の変更など）は email を含む種類で送る（送るモーダルも経路の下に注意を出す、部品 `SendLegalNotice`）。届かなかった人は回の配達 `GET /api/admin/messaging/dispatches/[id]/deliveries?status=failed`（`bounced`・`suppressed`・`unknown` も）で取り、行の `reason`・`errorCode` で理由を見る

## 連絡を足すとき

1. 書き出し: `pnpm generate message -- <domain> <name> --category <key> [--core]`。送る側のドメインに連絡の定義 `messages/<名前>.ts`（鍵 = `<ドメインのフォルダ名>.<名前>`）と、種類の経路にメールがあれば `messages/views/<名前>.tsx`（1 行スイッチ）・`.default.tsx`（既定の描き方）を無い時だけ書き、`src/registry/messageRegistry.ts` と拡張点の一覧を作り直す。fork は自分のドメインに足す（core のドメインは `--core` = 上流だけ）。使い方: `scripts/structure/message/README.md`、定義の書き方: src/lib/messaging/README.md
   - 種類（category、全部の連絡に必須）: 利用者から見て 1 つの出来事（「〜した時」、D79。例 likeReceived・itemSold・passwordReset）で、種別（7 つ）と経路を持つ。無ければ先に `categories/<名前>.ts` を足す。連絡は種別も経路も書かない（D81・D86）
   - 経路: 属する連絡は全部その種類の経路で届く。コードから自動で送る連絡はその回の経路を変えない（`channels` を渡さない。1 本だけ変えたいなら別の種類）。管理者が手で送る時だけ、種類の経路の中で絞れる（足せない）。回にはその回に使った経路が残る
   - 上流の種類: emailVerification・passwordReset・emailChange・earlyRegistration（functional・email）/ accountLocked（security・email）/ registrationComplete（transactional・email、会員登録の完了 2 本）/ walletExpiring（activity・email + inApp、失効の予告 = 利用者が止められる D67）/ walletExpired・walletAdjusted（transactional）/ marketing（キャンペーン情報）/ announcement（運営からのお知らせ、管理者がその場で書く告知）/ operatorDirect（direct、管理者からの個別の連絡と一覧の一括の既定）。汎用の activity は消した（D85。fork は利用に伴う知らせを自分の種類で足す）。鍵と表示名は仮
2. 送り手は定義を import して `messagingService.sendMessage` / `sendMessageToMany` を呼ぶ（このドメインに汎用の送信 API は無い。管理者の一括送信だけ `/api/admin/messaging/bulk-send`）。送り元 `source` の既定は定義の鍵
3. cron・CLI から呼ぶときは `runAsSystem`（`@/lib/audit`）で包む
4. 新しい送信の画面・バッチでは `idempotencyKey` を必ず渡す

`constants/sources.ts` の `MESSAGING_SOURCES` は送り元の識別子（wallet の失効の知らせが使う。`USER_HUB_DETAIL_SEND` / `SHIPPING_REQUEST_BULK` は fork の送り元として残している）。送り元の表示名は受け口 `sources/` の項目。

実例: auth / user の連絡（`src/features/core/{auth,user}/messages/`）・wallet の失効の知らせ（cron、`runAsSystem` + 冪等の鍵）

---

## 受け口(extensionPoints.ts)

連絡の仕組みに fork が部品を足す受け口(型 3: 置くだけで載る)。項目は `<受け口>/<名前>.ts` に `export const <単数> = { … }` で置き、`pnpm generate extensions` が `extensions/<受け口>.ts`(鍵 → 項目)にする。項目の型は `@/lib/messaging`(`src/lib/messaging/README.md`「受け口の項目」)。

| 受け口 | export | 型 | 何を足すか |
|---|---|---|---|
| `channels/` | `channel` | `MessageChannel` | 経路(プッシュ・SMS など。宛先の決め方・欄の zod・送る関数・webhook の表) |
| `enrichers/` | `enricher` | `MessageEnricher` | 上流の連絡に足す値(当てる連絡・足す変数の zod・値を返す関数) |
| `categories/` | `category` | `MessageCategory` | 種類(1 つの出来事、D79。種別 7 つのどれか・経路・グループ。上流の種類の `<名前>.override.ts` で label・description・channels・group) |
| `categoryGroups/` | `group` | `MessageCategoryGroup` | 種類のグループ(設定画面の見出しだけ、同じ種別の種類だけ。上流は出荷しない) |
| `audiences/` | `audience` | `MessageAudience` | 管理の送信の宛先の集め方(引数の zod・keyset で利用者 id) |
| `sources/` | `source` | `MessageSource` | 送り元の表示名 |
| `bulkSendTargets/` | `bulkSendTarget` | `MessageBulkSendTarget`(`services/server/admin/types.ts`) | 管理の一括送信の対象(選んだ記録 → 利用者 id・送った後の処理) |
| `subscribers/` | `subscriber` | `MessageSubscriber` | 送った後の購読(受ける事件・絞り・事件の束の処理、少なくとも 1 回) |

- 上流の項目: 経路 email・inApp・line、種類 marketing・activity、値 displayName、一括送信の対象 bankTransferReview(表は「管理の送信と回の読む口」)

## 関連

- [lib/messaging](../../../lib/messaging/README.md) … 連絡の定義・上書き・検査・受け口の項目の型
- [lib/mail](../../../lib/mail/README.md) … メールの送信と見た目の部品(メールの経路の項目が使う)
- [auditLog](../auditLog/README.md) … 管理の操作の記録先
