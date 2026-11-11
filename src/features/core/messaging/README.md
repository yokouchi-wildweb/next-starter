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
├── messages/                    # 連絡の定義 adminMessage（管理者の連絡）、views/ = 描き方の 1 行スイッチ、parts/ = 描き方の部品
├── constants/
│   └── sources.ts               # MESSAGING_SOURCES（送り元の識別子。wallet の失効の知らせが使う）
├── legacy/                      # 前のお知らせの表の定義だけ（読み手は写しの task だけ。写しのため push に残す。README あり）
├── scripts/migrations/          # 写しの task copy-legacy-notifications（下の「旧お知らせの写し」）
├── entities/
│   ├── drizzle.ts               # message_dispatches テーブル
│   ├── delivery.ts              # message_deliveries / message_events
│   ├── inbox.ts                 # message_inbox_items / _reads / _read_states
│   ├── template.ts              # message_templates / message_template_versions
│   ├── preference.ts            # message_preferences / message_suppressions
│   ├── endpoint.ts              # message_endpoints
│   ├── idempotencyKey.ts        # message_idempotency_keys
│   ├── schema.ts                # 値の一覧（状態・理由）と jsonb の Zod
│   └── model.ts                 # 入出力の型
├── services/client/
│   ├── endpointClient.ts        # 本人の端末の帳簿の API
│   ├── inboxClient.ts           # 本人の受け取り箱の API（一覧はカーソル）
│   └── adminMessagingClient.ts  # 管理の一括送信・回の読む口・続きを送る（一覧と配達はカーソル）
├── hooks/                       # useMessageEndpoints / useInboxItems / useInboxUnreadCount / useMarkInboxItemRead / useMarkAllInboxRead
│                                # 管理: useAdminBulkSend / useAdminBulkSendForm / useAdminDispatches / useAdminDispatch / useAdminDispatchDeliveries / useContinueDispatch
├── components/
│   ├── InboxList/               # 入れ物: 受け取り箱の一覧（詳細・既読・すべて既読）
│   ├── InboxUnreadModal/        # 入れ物: 未読を 1 件ずつ見せるモーダル（config で出す。枠には置いていない）
│   ├── AdminBulkSend/           # 管理一覧の一括操作の作成関数 bulkMessageAction と部品 AdminBulkSendButton
│   ├── AdminDispatchList/       # 入れ物: 送った回の一覧（絞り込み + カーソル）
│   ├── AdminDispatchDetail/     # 入れ物: 回 1 件・配達（カーソル）・続きを送る
│   └── common/                  # 部品（props だけ）: InboxItemRow / InboxItemDetail / InboxUnreadMark / DispatchRow / DispatchStatusBadge / DeliveryRow / DeliveryStatusBadge
└── services/server/
    ├── messagingService.ts      # 公開 API（sendMessage / sendMessageToMany・existingIdempotencyKeys・端末・受け取り箱・管理）
    ├── sendMessage/             # 新しい送る口（定義 → 回 → 展開 → 配達 → 経路の send → 記録）
    ├── sweep/                   # 送信の掃き出し・続きを送る・保持の掃除（cron messaging-send-sweep / messaging-retention）
    ├── endpoints/               # 端末の帳簿（本人の宛先の登録・削除・一覧、退会の後片付け）
    ├── unsubscribe/             # ワンクリックの配信停止（署名つきトークン・停止の記録）
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

前の送る口（`send` / `bulkSend`、S2 で消した）の回は `message_dispatches` に残り、`message_key` が null で件名・本文を前の列（`email_subject`・`email_body`・`notification_title`・`notification_body`・`email_success_count` など）に持つ。回の読む口（下の「管理の送信と回の読む口」）は前の列から件名・本文を返す。受信者ごとの監査ログ（`messaging.message.sent` / `failed`）は前の回だけにある（新しい送る口は配達の行で追い、受信者ごとの監査ログは書かない、D31）。前のお知らせの表は `legacy/`（README）。

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

まだ効かないもの（後の指令）: 間引き（throttle）。配信停止は下の「配信停止」。受信者ごとの監査ログは書かない（管理者の操作の監査は管理の指令）。

処理の値（`config.ts`、上書き `src/config/features/messaging.config.ts`）: `smallSendMaxRecipients` 100 / `inRequestBatchSize` 50 / `requiredRetry` 3 回（待ち 200ms・1000ms）/ `transientRetry` 初回を含め 5 回・60 秒 × 4 の累乗 / `expandChunkSize` 500

## 上流の経路の項目（channels/）

経路の受け口（`extensionPoints.ts` の `channels`）に上流が出す 3 本。fork の経路（push・SMS など）も同じ形で `channels/<名前>.ts` に足す。項目の形: `src/lib/messaging/README.md`「受け口の項目」。

- `email`（`channels/email/`）: 宛先 = `users.email`（削除済みを除く）。既定の描き方（`view.tsx`: 欄 subject・preheader・heading・paragraphs・cta・footer を lib/mail の枠と部品で）で描き、`lib/mail` の `send()` へ（冪等の鍵 = 配達の id）。`MailSendError` の分類（transient / permanent / unknown）をそのまま結果にし、それ以外の例外は unknown
  - 描画結果に React の「クライアントで描き直す」印（`<!--$!-->`・`$RX`）があれば送らず permanent（`render_fallback`）。部品が描画中に投げると `@react-email/render` は投げずにほぼ空のメールを返すため（L2.1、`fallback.ts`）
  - 連絡ごとの描き方: 送る口と cron は宛先に連絡の鍵（`messageKey`）を載せる。メールの項目はその鍵で生成の一覧（`messageRegistry`）の `view`（`messages/views/<名前>.tsx`）を引き（`loadView.ts`、束の中では連絡ごとに 1 回）、あればその `EmailView`、無ければ既定の `view.tsx` で描く。読めない・`EmailView` が無い = コードの誤り → 送らず permanent（`render_failed`）
  - `messages/views/<名前>.tsx` の形 = 1 行スイッチ（`export { EmailView } from "./<名前>.default"`、fork の丸ごとの差し替えは `.replace`）。`EmailView` は既定と同じ props（`content` = `{{鍵}}` を差し込んだ後のメールの欄・`theme` = `MailTheme`・`unsubscribeUrl?`）を受ける（型 `EmailViewProps`、`channels/email/view.tsx`）。変数（vars）は渡さない（秘密の変数を経路に出さない。文言は欄にあるので管理画面と override で直せる）
  - 色は `@/lib/mail` の `MAIL_THEME_COLORS`（生成物 `src/lib/mail/generated/themeColors.ts`）
- `inApp`（`channels/inApp/`）: お知らせ = `message_inbox_items`。宛先 = 利用者の id。選んだ宛先の送信と中身が受信者に依る送信は受信者ごとの行（同じ回 × 利用者の行が既にあれば書かない）
  - 全員・ロール宛てで、お知らせの中身が受信者に依る鍵（`recipientName`・`recipientEmail`・enrichers の鍵など）を使わない送信は、cron の展開の最初の束で回に 1 行の共有の行（`user_id` null、`target_roles` = ロールか null）を書き、受信者ごとの inApp の配達の行は作らない（D32）。数は束ごとに `channel_counts.inApp` の targeted・sent へ足す
  - 受け取り箱の利用者の API・既読・画面は受け取り箱の指令
- `line`（`channels/line/`）: 既定は**切**（`config.ts` の `channels.line.enabled`。開ける fork は `src/config/features/messaging.config.ts` に `channels: { line: { enabled: true } }` を書き、LINE の Messaging API の env と機能 `userLineProfile` も開ける）。宛先 = `user_line_profiles.line_user_id`（機能 `userLineProfile` が閉じていれば宛先なし）。`lib/line` の push（テキスト）。状態は lib/line の誤りの文から読む（429・5xx → transient / 他の 4xx → permanent / 応答なし → unknown）。provider の冪等の鍵はまだ送れない
- 経路の入切: 項目の `enabled: false` は項目が無い経路と同じ扱い（配達の行は `suppressed` + `channel_off`、送らない）。門の機能ではない

---

## 端末の帳簿（message_endpoints）

利用者 × 経路 × 宛先（プッシュの購読トークン・電話番号など）の帳簿（D43・D45）。帳簿を読むのは、自前の宛先の引き方（`resolveAddresses`）を持たない経路の項目（送る口が `message_endpoints` の有効な行から宛先を引く）。

- 受け付ける経路: 経路の受け口に項目があり、`enabled` で、`resolveAddresses` を持たない経路だけ。**上流の email・inApp・line は自前の帳簿なので受け付けない（今の上流では登録できる経路が 0 で、どれも 400）**。push・SMS などの経路を fork が足すと登録できる
- API `/api/me/messaging/endpoints`（`createMeRoute`、本人に束ねる。機能の門は持たない = 送る口と同じく常に開）
  - `GET` 本人の一覧 / `POST` 登録 `{ channel, address, kind?, metadata? }`（本人の同じ宛先は更新して有効に戻す。**他人が登録した宛先は付け替えず 409**）/ `DELETE ?id=` 本人の行を消す（他人の id は 404）
  - 返すのは安全な DTO（`id`・`channel`・`kind`・`addressHint` = 宛先の末尾 6 文字・`isActive`・`lastUsedAt`・`createdAt`）。宛先の全体と `metadata` は返さない
  - 入力はどの経路も同じ形（`address` 2048 文字まで、`kind` 32 文字まで、`metadata` は平らな値で 2KB まで・秘密は入れない）。経路ごとの形は後の指令
- client: `services/client/endpointClient.ts`、hook `useMessageEndpoints()`（`{ endpoints, register, remove, … }`）。宛先を渡して登録するだけで、通知の許可・Service Worker・ネイティブの SDK は fork が持つ
- 退会: user の後片付けの項目 `cleanupHandlers/messagingEndpoints.ts`（required: 個人の情報なので失敗したら退会ごと戻す）が本人の行を全部消す

---

## 配信停止（種類・好み・宛先の停止）

D35。単位 = 種類 × 経路。連絡の定義の `category` が種類の鍵（`categories/` の受け口。上流は `marketing`・`activity`、fork は `categories/<名前>.ts` で足す）。

- 好みに従う連絡 = 種別が `transactional` でなく `required` でもない連絡。取引と required は好みを見ない
- 好み（`message_preferences`、止めた時だけ行）: 利用者 × 種類 × 経路。種類・経路の `'*'`（`MESSAGE_ALL`）は全部に当たる
- 宛先の停止（`message_suppressions`、正規化した宛先 = 前後の空白を外して小文字の sha256）: required でない連絡は `hard_bounce`・`complaint`・`manual` にいつも従い、`one_click` は範囲（scope）が連絡の種類か `'*'` の時だけ従う。required は `hard_bounce` だけに従う。宛先が複数なら止めた宛先だけを外す
- 確かめる所: 小さな送信の展開・cron の展開・cron が送る直前（キューに置いた後で止めた人も外す。宛先の 1 つにもう送れた行は sent のまま送り直しをやめる）
- 外した受信者: 選んだ宛先は `suppressed` + reason `preference` / `suppression` の行、全員・ロール・audiences は行を作らない。どちらも `channel_counts.<経路>.suppressed` に数え、どの経路でも止められた受信者は `recipient_count` から引く（D31）
- 全員・ロール宛てのお知らせの共有の 1 行は、書く時に利用者ごとの inApp の好みを当てない。受け取り箱の利用者の API（後の指令）が、回の `category`（`dispatch_id` で引ける）と見る人の inApp の好みで共有の行を外す
- メール（D35・D57）: 好みに従う連絡の宛先には、送る口が `category` と、署名の鍵の env があれば `List-Unsubscribe: <停止の URL>`・`List-Unsubscribe-Post: List-Unsubscribe=One-Click`（RFC 8058）を付ける（経路の宛先 `ChannelSendTarget` の `category`・`headers`）。メールの項目はヘッダを lib/mail に渡し、本文の最後に停止のリンクを出す
  - **決まり: `category` があるのに `List-Unsubscribe` が無い = 鍵（`MESSAGING_UNSUBSCRIBE_SECRET`）が無い → そのメールは送らず permanent（reason `unsubscribe_key_missing`）**。取引・required の連絡はヘッダなしで送る
  - provider の一括停止の機能は使わない

## ワンクリックの配信停止の受け口 /api/messaging/unsubscribe（常に開・門なし）

- トークン = base64url(JSON {v:1, r, c, ch, a?}) + . + HMAC-SHA256(MESSAGING_UNSUBSCRIBE_SECRET)。`services/server/unsubscribe` の signUnsubscribeToken / verifyUnsubscribeToken / buildUnsubscribeUrl（getAppBaseUrl() + /api/messaging/unsubscribe?t=）/ isUnsubscribeConfigured
- POST（RFC 8058 のワンクリック、ログイン不要）: user:<id> → message_preferences（種類 × 経路、source one_click）、addr:<hash> → message_suppressions（reason one_click、scope = 種類）。何度届いても同じ。トークンの誤りは 400
- GET: 状態を変えず、同じ URL へ POST するボタン 1 つの確認のページ（script なし）
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
- 共有の行: 好みに従う回（種別が `transactional` でない）で、見る人が inApp か `'*'` の経路で回の `category` か `'*'` を止めていれば見せない（共有の行は書く時に好みを当てないので読む時に当てる）
- 取り下げた回の行は消えている（`retracted_at` は回にだけ残る）

既読: `message_inbox_reads` の行がある か 公開の時刻 ≤ `message_inbox_read_states.read_watermark_at`。全部既読は 1 つの取引で watermark を今に進め、公開の時刻 ≤ 今の自分の個別の既読の行を掃く（watermark が覆うので既読のまま）。

受け取り箱の画像と保存の台帳（`inbox/imageBinding.ts`・台帳の口 `inbox/imageBindingLedger.ts`）:

- 持ち主は回: 台帳の紐付け = `messaging.dispatch` / 回の id / `inApp.image`（用途 `notification.image`）。受け取り箱の行ではない理由: 台帳の 1 つのファイルは 1 つの業務行にしか結べず、宛先ごとの行は同じ画像を指す（行ごとに持たせると宛先の数だけ複製と strip の描き直しが要る）。宛先ごとの行は利用者の削除の cascade でも消え、messaging は serviceRegistry に無いので storage の照合はこの種類を飛ばす（`unregistered`）。受け取り箱の行は回より長生きしない（FK cascade。保持の掃除はお知らせの行の無い回だけを消す）ので、回を消す時に外せば全部の道を覆う
- 結ぶ: お知らせの行を書く前、回の行を排他で持った取引の中で（共有の行 = 展開の `store.expandOne`、宛先ごとの行 = inApp の経路の `bindImages`）。`storage://` でない値（固定の URL）は結ばない
  - 回の actor が上げた未紐付けの `notification.image` の画像 → そのまま回に attach
  - 別の人が上げた・他の業務行に結ばれた・用途の違う画像 → 回ごとに 1 回 copy（持ち主なし）して複製を attach（coupon の `issueCodeForOwner` と同じ。元と ref を共有しない）。複製の失敗は投げる（黙って画像なしにしない）
  - 対応 `{ <元の参照>: <結んだ参照> }` を回の `metadata.inboxImages` に残し、束・送り直しは同じファイルを使う
- 外す: 保持の掃除が回を消す取引の中で `metadata.inboxImages` の値を detach（`record_removed`）。取り下げ（S3、行を消して回は残す）は画像を回に結んだまま残し、保持の掃除が回を消す時に外れる
- 写した前のお知らせ: 写しの task の images の段が、古い紐付け（`notification` / お知らせの id / `image`）を写した回（同じ id）へ付け替える（下の「旧お知らせの写し」）

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
- 未読のモーダル: 旧 `UnreadNotificationModal` と同じふるまい（指定の住所へ来たら未読を古い順に 1 件ずつ、見せた行は既読、次へ / スキップ = 全部既読 / 確認完了、確かめた id は sessionStorage）。値は `config.ts` の `inbox.showUnreadModal`（既定 false）・`inbox.unreadModalPaths`（既定 `["/"]`、末尾 `*` で前方一致）、上書きは `src/config/features/messaging.config.ts`。利用者の枠（UserLayout）には置いていない（旧部品の削除の指令で付け替える）
- ページ `/messages`（`src/app/(user)/(protected)/messages/`）: `page.tsx` の 1 行スイッチ → `_screen/MessagesScreen.tsx`（題「お知らせ」+ `InboxList`）+ `_screen/loader.ts`（access authenticated、閉なら notFound）。初めの一覧もサーバーでは取らない（入れ物が hook で取る）
- 門: 規則 `messagingInbox`（`src/featureGate/rules/messagingInbox.ts`、住所 `/messages`、既定 閉）。API と表は常に開（domains は持たない）。開ける fork は `src/config/featureGate/switches.config.ts`

---

## 管理の送信と回の読む口（/api/admin/messaging/**）

管理者だけ（API の access `roleCategories: ["admin"]` と service の `assertAdmin` の両方。service は監査の文脈の操作者の役割の分類を引き、runAsSystem の system も通す）。操作は監査ログに 1 行。機能の門 `messagingDispatches`（既定 開）が回の読む口・続きを送る（`/api/admin/messaging/dispatches`）と管理画面 `/admin/messaging` を持つ。一括送信 `bulk-send` は門に入れない（管理一覧の一括操作が使うので、画面を閉じても送れる）。

### 管理者の連絡（連絡の定義 `messages/adminMessage.ts`、鍵 `messaging.adminMessage`）

- 管理者が送るたびに書く中身を vars で渡す: `subject`・`body`（メール）・`inAppTitle`・`inAppBody`（お知らせ）・`serviceNameShort`。宛名 `{{displayName}}` は `enrichers/displayName.ts`（名前が無ければ「お客様」）。管理者の文面の中の `{{鍵}}` はまだ差し込まない（保存テンプレートの指令で）
- 見た目は前の管理者のお知らせのメールと同じ（`views/adminMessage.tsx` → `.default.tsx`、部品 `messages/parts/AnnouncementMailView.tsx`）。段落の位置の約束: `paragraphs` [0]「… からのお知らせ」（ロゴの下）→ [1]「… 様」→ 区切り → [2] 本文（改行はそのまま）→ 区切り → `footer`。fork は `adminMessage.replace.tsx` で管理者の連絡の見た目をまとめて替える
- 種別の既定は marketing（種類 marketing、受信者の好みに従う）。選んだ利用者宛て（一括送信は常にそう）に限り、要求で `kind: "transactional"` を明示すると好みで止めずに送る（定義の写しの kind だけを替える。種類は marketing のまま）

### `POST /api/admin/messaging/bulk-send`（一括送信）

- 入力（`AdminBulkSendInputSchema`）: 宛先は `{ userIds }` か `{ target, recordIds }` のどちらか 1 つ（1 回 10,000 人まで）・`kind?`（`marketing` 既定 | `transactional`）・`channels`（`email` / `inApp` の 1 つ以上）・`email?: { subject, body }`（email を送るなら必須）・`inApp?: { title, body }`（inApp を送るなら必須）・`idempotencyKey?`（8〜128 文字）・`source?`（既定 `<target>.bulk`、userIds なら `messaging.adminBulk`）・`reason?`・`isTest?`
- 結果: `{ dispatchId, status, counts: { recipientCount, channelCounts, queuedCount }, afterSend: { ok: true } | { ok: false, error } | null }`。大きな送信の続きは cron が送る
- 受け口 `bulkSendTargets/<名前>.ts`（`export const bulkSendTarget: MessageBulkSendTarget`、型 `services/server/admin/types.ts`）: `key`・`label`・`enabled?`・`resolveUserIds(recordIds)`（選んだ記録 → 利用者 id）・`afterSend?({ recordIds, dispatchId, counts, content })`（送信の受け付けの直後に 1 回。投げても送信は戻らず結果と監査に失敗を残す）。上流の項目 `bankTransferReview`（振込審査 → 申告した利用者、メールを送ったら管理メモに「YYYY/MM/DD「件名」メール送付」）
- 監査: `messaging.dispatch.bulkSent`（対象 = 回、metadata = 送り元・種別・経路・数・状態・対象の鍵・afterSend）

### 回の読む口（D37。汎用 CRUD の search に乗せない）

- `GET /api/admin/messaging/dispatches`: 条件 `from`・`to`（作った時刻）・`messageKey`・`kind`・`channel`・`status`・`cursor`・`limit`（既定 50、最大 100）→ `{ items: AdminDispatchSummary[], nextCursor }`（新しい順、keyset）
- `GET /api/admin/messaging/dispatches/[id]` → `AdminDispatchDetail`
- `GET /api/admin/messaging/dispatches/[id]/deliveries`: 条件 `status`・`channel`・`cursor`・`limit` → `{ items: AdminDeliveryRow[], nextCursor }`（古い順）
- 返す項目は `services/server/admin/dispatchDto.ts` 1 か所: 鍵・種別・種類・送り元・状態・経路・件名 / 題（headings）・数・送った人・時刻・テストかは常に、回の本文（rendered）と vars は記録の段が vars / full のとき、配達の vars は vars / full、配達の本文は full のときだけ、宛先は出す、provider の生の値（provider_message_id・事件の payload）と last_error の文は出さない（状態と reason の符号で見る）。前の送る口の回（message_key が null）は件名・題・本文を前の列から

### `POST /api/admin/messaging/dispatches/[id]/continue`（続きを送る）

- `continueSending`（1 束だけ進める。processing の回だけ、他は 409）→ `{ expanded, claimed, sent, failed, completed }`。監査 `messaging.dispatch.continued`

### 管理一覧の一括送信の作成関数（`components/AdminBulkSend`）

管理一覧の一括操作の受け口 `adminBulkActions` の項目を数行で作る（`@/lib/crud/components` の `bulk*Action` と同じ形。lib は features を読めないので messaging に置く）。対にサーバーの受け口 `bulkSendTargets/<名前>.ts` が要る（記録 → 利用者 id と afterSend はサーバーの項目だけが持つ。画面は鍵 `target` と選んだ id を送るだけ）。

```tsx
// src/features/<domain>/adminBulkActions/notify.tsx
import { bulkMessageAction } from "@/features/core/messaging/components/AdminBulkSend";

export const bulkAction = bulkMessageAction(
  { key: "notify", order: 100 },
  { target: "<bulkSendTargets の key>", recordNoun: "発送リクエスト", defaultKind: "transactional" },
);
```

- options（`BulkMessageActionOptions`）: `target`・`recordNoun`（文に入る名詞）・`defaults?`（`emailSubject`・`emailBody`・`inAppTitle`・`inAppBody` の初期値）・`defaultKind?`（既定 marketing）・`kindSelectable?`（既定 true）・`defaultEmail?` / `defaultInApp?`（最初に送る側にする経路、既定どちらも true）・`subjectPlaceholder?`・`label?`（既定「一括送信」）・`source?`・`disabled?`・`onSent?(result)`（送った結果。サーバーの afterSend とは別の画面の側の後処理）
- 流れ: ボタン → 書く（Modal。経路・種別・件名 / 本文・題 / 本文）→ 確かめる（Dialog、送る間 loading）→ 結果（数・経路ごとの数・afterSend の成否・回の詳細へのリンク）。成功で `onDone`（選択を外し一覧を取り直す）
- 二重送信: フォームを開くたびに `idempotencyKey` を 1 つ発行し、同じフォームの再試行は同じ鍵を送る
- 書く欄の状態と送信は hook `useAdminBulkSendForm`（部品は描くだけ、CLAUDE.md core_ui_guards）。見た目を替える fork は部品を写して hook を呼ぶ
- 上流の使い手: `bankTransferReview/adminBulkActions/sendEmail.tsx`（target `bankTransferReview`、既定の種別 transactional）

### 利用者ごとの履歴（`messagingService.listUserMessageHistory`）

- `messagingService.listUserMessageHistory(userId, { cursor, limit })` → `{ items, nextCursor }`。その利用者の配達（1 行 = 1 経路）を回と結び新しい順
- 項目は `dispatchId`・`messageKey`・`kind`・`source`・`channel`・`status`・`headings`・`createdAt`・`sentAt`（本文・宛先・provider の値は出さない）
- server だけ・route なし・管理者を確かめない: 呼び手（fork の管理の service / route）が読める人を決める
- 出ない物: 全員・ロール宛ての受け取り箱の共有行、配達を持たない前の送る口の回、消した利用者の配達

### 送った回の管理画面（`/admin/messaging`、門 `messagingDispatches`、既定 開）

- `/admin/messaging`: 入れ物 `AdminDispatchList`（`initialFilters?`・`limit?`）= 絞り込み（期間・定義の鍵・種別・経路・状態）+ 回の行（`common/DispatchRow`）の無限スクロール（カーソル）
- `/admin/messaging/[id]`: 入れ物 `AdminDispatchDetail`（`dispatchId`）= 回の中身（状態・件名 / 題・経路ごとの数・送った人・時刻・本文は記録の段しだい）+ 「続きを送る」（状態 processing の回だけ、ConfirmPopover）+ 配達（状態・経路で絞る、カーソル、`common/DeliveryRow`）
- loader は認可だけ（`roleCategories: ["admin"]`）。データは hook（`useAdminDispatches`・`useAdminDispatch`・`useAdminDispatchDeliveries`・`useContinueDispatch`）
- 管理メニュー: `src/features/core/admin/menu/items/messagingDispatches.ts`（マーケティング > 送信の履歴）

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

処理の値: `sweep` { `budgetMs` 240000・`deliveryChunkSize` 100・`expandChunksPerRun` 20・`leaseSeconds` 300 } / `retention` { `eventsDays` 30・`deliveriesDays` 90・`dispatchesDays` 730・`idempotencyKeyDays` null・`chunkSize` 1000・`budgetMs` 240000 }

---

## 新しい連絡の基盤の表（定義だけ。使う側はまだない）

新しい送る口・配達・受け取り箱のための表。今は定義と schemaRegistry への登録だけで、読み書きするサービス・API・cron はまだない（後の段で足す）。

- `message_dispatches`（同じ表に列を追加）: `message_key`・`template_id` / `template_version`（版の固定）・`kind` / `category`・`audience` jsonb・`tags`・`scheduled_at`・`channel_counts` jsonb（`{<経路>: {targeted, sent, failed, skipped_no_address, skipped_throttled, suppressed}}`）・`headings` / `vars` / `rendered` jsonb（経路が受け口なので経路を鍵にする）・`record`（meta / vars / full）・`show_to_later_signups`（既定 false）・`retracted_at`・`is_test`（既定 false）・`updated_at`・`expand_cursor`（展開の再開位置、cron の節）。古い列はそのまま（次の段で落とす）。`status` の値は `scheduled / processing / completed / completed_with_failures / cancelled` に広げた（列は同じ）
- `message_deliveries`: 受信者 × 経路 の 1 行。`UNIQUE(dispatch_id, channel, recipient_key)`。lease は `locked_until` + `lock_token`、送り直しは `next_attempt_at`。複数の宛先は `targets` jsonb。利用者を消すと `user_id` は null（`recipient_key` は残る）
- `message_events`: provider の事件（追記だけ）。`UNIQUE(provider, provider_event_id)`
- `message_inbox_items`: お知らせ。全員・ロール宛ては `user_id` null の共有の 1 行（`target_roles` null = 全員）、個人宛ては受信者ごとの行。回を消すと一緒に消える（取り下げはこの行を消す）
- `message_inbox_reads` / `message_inbox_read_states`: 個別の既読と全既読のウォーターマーク（notification_reads / notification_read_states と同じ形）
- `message_templates` / `message_template_versions`: 保存されたテンプレートと版（版は追記だけ、`UNIQUE(template_id, version)`）
- `message_preferences`: 利用者が止めた 種類 × 経路（止めた時だけ行、全体は `'*'`）。`UNIQUE(user_id, category, channel)`
- `message_suppressions`: 宛先の停止（`address_hash` = 正規化した宛先の sha256）。`UNIQUE(channel, address_hash, scope)`、`scope` `'*'` = 全種類
- `message_endpoints`: 端末の帳簿（利用者 × 経路 × 宛先）。`UNIQUE(channel, address)`
- `message_idempotency_keys`: 保持の cron が回を消す時に冪等の鍵を移す先（回の行は消えるので FK なし）

値の一覧（状態・理由）と jsonb の zod は `entities/schema.ts`、行の型は `entities/model.ts`。

---

## 旧お知らせの写し（`pnpm task messaging:copy-legacy-notifications`）

前のお知らせの表（`legacy/`: `notifications`・`notification_reads`・`notification_read_states`・`notification_templates`）の中身を新しい表へ写し、前の送る口の回（`message_dispatches` の `message_key` が null の行）の古い列を同じ行の新しい列へ写す 1 回きりの移行（D52・D55）。ファイルは `scripts/migrations/copy-legacy-notifications.ts`（流れ `lib.legacyCopy.ts`・列の対応 `lib.legacyCopyMap.ts`・DB の置き場 `lib.legacyCopyStore.ts`・テスト `copy-legacy-notifications.test.ts`）。

手順（notice の required_actions の順）:

1. 古いアプリの書き込みを止める → merge・再生成 → `pnpm db:push`（新しい表と列を作る。古い表は残る）
2. `pnpm task messaging:copy-legacy-notifications -- --dry-run`（書かずに照合の数だけ出す。写す前は copied が 0）
3. `pnpm task messaging:copy-legacy-notifications`（本番は `--env production --confirm=production`）
   - 予算（既定 240 秒、`-- --budget-ms=<ms>`）で止まると status `incomplete`・終了コード 2・`stoppedAt`（止まった段）を返す。止める鍵を取らないので、同じ命令をもう一度打てば続きから写す
   - 全段を終えると照合する。合えば `succeeded`（止める鍵 `migration:<notice の id>:messaging:copy-legacy-notifications` を取る = 二度目は拒否）、合わなければ `failed`（鍵を取らない。結果に数を残す。直してそのまま打ち直せる）
4. 済みの印 = `task_runs` の `succeeded` の行で `result.reconciliation.ok = true`。S3 の古い表の DROP はこの行を見る（`pnpm ops db inspect query "select status, result->'reconciliation' from task_runs where name = 'messaging:copy-legacy-notifications' order by started_at desc limit 1"`）

続きから写せる理由（checkpoint の行は持たない）:

- 新しい行の id を写し元の id から決める: 回 = お知らせの id、共有の行 = お知らせの id、個人宛ての行 = `md5(<お知らせの id>::text || ':' || <利用者の id>::text)::uuid`、テンプレート = 古い id
- 書き込みは `ON CONFLICT DO NOTHING`（watermark だけは大きい方を残す `GREATEST`）。何度打っても同じ結果
- 各段は「写し先の主キーにまだ無い行」だけを `NOT EXISTS` で取り、`runBudgetedBatches` で束（500 行）ごとに写す。回とお知らせの行は 1 つの取引で書くので、回があればお知らせの行もある
- 段の順: テンプレート → お知らせ（回 + お知らせの行）→ 画像の台帳の付け替え → 既読 → watermark → 前の送る口の回の新しい列

列の対応:

- お知らせ 1 行 = 回 1 つ（`status` completed・`expand_cursor` `'~done'`・`source` `legacy.notification`・`tags` `['legacy']`・`channels` `['inApp']`・`metadata.legacyNotificationId`・`actor_type` = `sender_type`・`actor_id` = `created_by_id`・`template_id`・`completed_at` = 公開の時刻・`show_to_later_signups` false = 前の規則）。新しい cron は拾わない（`message_key` が null で `'~done'`）
- お知らせの行: 全員・ロール宛ては共有の 1 行（`target_roles`）、個人宛ては今いる利用者ごとの行（重なりは 1 行。消えた利用者・uuid の形でない値は写さず `skipped` に数える）。`metadata` = 元の metadata + `legacyNotificationId`、`is_silent` は `silent: true`（受け取り箱の「静かな行」）。`image` の ref はそのまま（用途 `notification.image`。台帳の紐付けは images の段が回へ付け替える）
- 画像の台帳: 古いお知らせの行に結ばれた ready の行（`notification` / お知らせの id / `image`）を、写した回（`messaging.dispatch` / 同じ id / `inApp.image`）へ付け替える。`storageObjectService.rebind` は種類を変えないので、1 回きりの移しのために storage のサービスの口を広げず、移行の中で条件つきの UPDATE を打つ（条件が合う行だけ動くので何度でも同じ）。写した回の `metadata.inboxImages` に `{ ref: ref }` を残す（保持の掃除が外せる）
- 公開の時刻が未来のお知らせ（予約）: 回は completed のまま、お知らせの行の `published_at` を未来のまま写す（受け取り箱の「公開の時刻 ≤ 今」が時刻まで隠す）
- 既読 → 行き着くお知らせの行（個人宛ては読んだ人の行。行が無い既読 = 宛先に入っていない人の既読は写さず `skipped`）。watermark はそのまま（写し先に新しい値があれば大きい方）
- テンプレート: `key` `legacy-<古い id>`・`category` marketing・`status` draft（管理の画面で見えて送る画面には出ない。S3 のテンプレートの管理で見直して公開する）・`channels` `['inApp']`・内容は `{ inApp: { title, body } }`・版 1 を `message_template_versions` に 1 行。`variables` は新しい形に合う時だけ写し、合わなければ `[]` にして元の値を `description` に残す（古い category system / manual も `description` に）
- 前の送る口の回（同じ行）: `headings` = `{ email: email_subject, inApp: notification_title }`、`rendered` = `{ email: { subject, paragraphs: [email_body] }, inApp: { title, body } }`、`channel_counts` = email `{ targeted: recipient_count, sent: email_success_count, failed: email_failed_count }`・inApp（`notification_created` が true なら targeted = sent = recipient_count）。`status`・`expand_cursor` は触らない。古い列は S3 の push で落とす

照合（`result.counts`、項目ごとに `{ source, expected, copied, skipped? }`。全部 `expected = copied` で ok）: テンプレート・版・回・お知らせの行（共有 + 今いる宛先）・既読（行き先のある既読）・watermark（写し先が写し元以上）・画像の台帳（古いお知らせの行に残る ready の行が 0）・前の送る口の回（埋めた行）。写さない物（消えた利用者の宛先・行き先の無い既読）は expected の外に数え、`skipped` に出す。

集計の注意: 前の送る口で送ったお知らせは前の回の行（`message_key` null）も残るので、写した回（`source` `legacy.notification`、`tags` `legacy`）と同じお知らせが 2 つの回に出る。analytics（S3）は `source` `legacy.notification` の回を受け取り箱の既読の数だけに使い、送信・到達の数には入れない。

---

## 連絡を足すとき

1. 送る側のドメインに連絡の定義 `messages/<名前>.ts`（鍵 = `<ドメインのフォルダ名>.<名前>`）と、メールの見た目を変えるなら `messages/views/<名前>.tsx`（1 行スイッチ → `.default.tsx`）を置き、`pnpm generate registry`。書き方: src/lib/messaging/README.md
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
| `categories/` | `category` | `MessageCategory` | 配信停止の種類(基の種別 marketing / activity) |
| `audiences/` | `audience` | `MessageAudience` | 管理の送信の宛先の集め方(引数の zod・keyset で利用者 id) |
| `sources/` | `source` | `MessageSource` | 送り元の表示名 |
| `bulkSendTargets/` | `bulkSendTarget` | `MessageBulkSendTarget`(`services/server/admin/types.ts`) | 管理の一括送信の対象(選んだ記録 → 利用者 id・送った後の処理) |
| `subscribers/` | `subscriber` | `MessageSubscriber` | 送った後の購読(受ける事件・絞り・事件の束の処理、少なくとも 1 回) |

- 上流の項目: 経路 email・inApp・line、種類 marketing・activity、値 displayName、一括送信の対象 bankTransferReview(表は「管理の送信と回の読む口」)

## 関連

- [lib/messaging](../../../lib/messaging/README.md) … 連絡の定義・上書き・検査・受け口の項目の型
- [lib/mail](../../../lib/mail/README.md) … メールの送信と見た目の部品(メールの経路の項目が使う)
- [auditLog](../auditLog/README.md) … 管理の操作の記録先
