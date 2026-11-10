# messaging ドメイン

管理者・システムから「特定のユーザーに向けて」送るメッセージ（メール / サービス内通知）の送信窓口。送信そのものに加えて、送信ジョブ単位の記録（`message_dispatches`）と受信者単位の監査ログ（`audit_logs`）を必ず残す。

**ユーザー宛の任意メッセージは必ず `messagingService.send` / `bulkSend` を経由する**（CLAUDE.md PROHIBITED）。各呼び出し元が `lib/mail` の `send()` を直接呼ぶと、受信者単位の記録や本文の保存が漏れる（実際に過去に漏れた）。`lib/mail` を直接使ってよいのは、パスワードリセット・メール認証・登録などのシステムテンプレートメールだけ。

送信の UI・API ルートは持たない（端末の帳簿の `/api/me/messaging/endpoints` だけ持つ）。送信画面や送信 API は呼び出し側（各ドメインの wrappers、fork の `_components/` など）が用意し、サーバー側からこのサービスを呼ぶ。

---

## ディレクトリ構成

```
src/features/core/messaging/
├── index.ts                     # 定数と型のみ再エクスポート（サービスは出さない）
├── config.ts                    # 送る口の処理の値（上書き: src/config/features/messaging.config.ts）
├── channels/                    # 経路の受け口の上流の項目 email / inApp / line（<名前>/index.ts(x) の export const channel）
├── constants/
│   ├── channels.ts              # MESSAGING_CHANNELS（email / inApp）
│   ├── sources.ts               # MESSAGING_SOURCES（送信経路の識別子）
│   ├── actions.ts               # MESSAGING_AUDIT_ACTIONS（監査 action 名）
│   └── limits.ts                # 文字数上限・バルクのチャンクサイズ
├── entities/
│   ├── drizzle.ts               # message_dispatches テーブル
│   ├── delivery.ts              # message_deliveries / message_events
│   ├── inbox.ts                 # message_inbox_items / _reads / _read_states
│   ├── template.ts              # message_templates / message_template_versions
│   ├── preference.ts            # message_preferences / message_suppressions
│   ├── endpoint.ts              # message_endpoints
│   ├── idempotencyKey.ts        # message_idempotency_keys
│   ├── schema.ts                # Zod（MessagingSendInputSchema / MessagingBulkSendInputSchema）
│   └── model.ts                 # 入出力の型
└── services/server/
    ├── messagingService.ts      # 公開 API（sendMessage / sendMessageToMany + 古い send / bulkSend / findExistingIdempotencyKeys）
    ├── sendMessage/             # 新しい送る口（定義 → 回 → 展開 → 配達 → 経路の send → 記録）
    ├── sweep/                   # 送信の掃き出し・続きを送る・保持の掃除（cron messaging-send-sweep / messaging-retention）
    ├── endpoints/               # 端末の帳簿（本人の宛先の登録・削除・一覧、退会の後片付け）
    ├── send.ts                  # 単発送信
    ├── bulkSend.ts              # 一括送信
    ├── dispatch.ts              # message_dispatches の INSERT / UPDATE
    ├── auditing.ts              # 受信者単位の audit_logs 記録
    └── channels/
        ├── email.tsx            # AdminAnnouncementEmail テンプレート + lib/mail
        └── inApp.ts             # notification の sendDirect（individual 宛）
```

---

## 使い方

```ts
import { messagingService } from "@/features/messaging/services/server";
import { MESSAGING_SOURCES } from "@/features/messaging";
```

サービスはサーバー専用。`index.ts` は Hook / コンポーネントから送信を呼ばせないため、定数と型だけを再エクスポートしている。

### send（1 ユーザー）

```ts
const result = await messagingService.send({
  recipient: { id: userId },
  channels: ["email", "inApp"],
  emailSubject: "件名",
  emailBody: "本文",
  notificationTitle: "通知タイトル",
  notificationBody: "通知本文",
  source: MESSAGING_SOURCES.USER_HUB_DETAIL_SEND,
  reason: "任意の送信理由",
  idempotencyKey: crypto.randomUUID(),
});
// result = { dispatchId, recipient: { userId, recipientEmail, email, inApp } }
```

- 受信者は ID だけを渡す。メールアドレスと名前はサービスが DB から取る（名前が無ければ「お客様」）
- ユーザーが存在しない → `DomainError(404)`
- `email` チャネル指定でメールアドレス未登録 → `DomainError(400)`（呼び出し側の契約違反として扱う）
- `inApp` チャネルはお知らせの機能(門番の規則 `notification`)が閉じていれば作らず、`inApp: { created: false, error }` で返す（例外にしない。送信の記録に残る）

### bulkSend（複数ユーザー）

```ts
const result = await messagingService.bulkSend({
  recipients: userIds.map((id) => ({ id })),
  channels: ["email"],
  emailSubject: "件名",
  emailBody: "本文",
  source: MESSAGING_SOURCES.BANK_TRANSFER_REVIEW_BULK,
  idempotencyKey,
  options: { chunkSize: 50 },
});
// result = { dispatchId, recipientCount, emailSuccessCount, emailFailedCount,
//            notificationCreated, perRecipient }
```

- `recipients` は ID で重複排除する。`recipientCount` と `perRecipient` は重複排除後の人数
- 存在しない・メールアドレス未登録のユーザーは throw せず、その受信者のメール失敗として記録して続ける
- メールは `chunkSize`（既定 50、上限 500）件ずつ `Promise.all` で並列に送り、チャンク同士は順番に送る。`chunkSize` が実質の最大並列送信数なので、メールプロバイダのレート制限に合わせて調整する

### チャネル

| チャネル | 送り方 | 失敗の単位 |
|---|---|---|
| `email` | `AdminAnnouncementEmail` テンプレートで `lib/mail` の `send()` を受信者ごとに呼ぶ | 受信者ごと。失敗しても他の受信者・他チャネルは続ける |
| `inApp` | notification ドメインの `sendDirect` で `targetType: "individual"` の通知を 1 レコード作る（bulk でも 1 レコード） | ジョブ全体。レコード作成に失敗すると全員分が失敗 |

- `channels` は 1 件以上。`email` を含むなら `emailSubject` / `emailBody`、`inApp` を含むなら `notificationTitle` / `notificationBody` が必須（Zod の superRefine とサービス側の両方で検証。違反は `DomainError(400)`）
- 2 つのチャネルは独立している。メールが失敗しても通知は作り、通知が失敗してもメールは止めない
- 通知の `sender_type` は実行コンテキストで決まる。`runAsSystem` の中なら `system`、それ以外は `admin`

### 入力の上限（constants/limits.ts）

| 項目 | 上限 |
|---|---|
| メール本文・通知本文 | `MESSAGE_BODY_MAX_LENGTH` = 65536 文字 |
| メール件名 | `MESSAGE_EMAIL_SUBJECT_MAX_LENGTH` = 998 文字 |
| 通知タイトル | `MESSAGE_NOTIFICATION_TITLE_MAX_LENGTH` = 200 文字 |
| `reason` | 500 文字 |
| `idempotencyKey` | 8〜128 文字 |

送信フォームや API ルートで入力を検証するときは `MessagingSendInputSchema` / `MessagingBulkSendInputSchema`（`entities/schema.ts`）を使う。

---

## 二重送信の防止（idempotencyKey）

- `idempotencyKey` を渡すと、同じキーでの 2 回目は**メールを 1 通も送る前に** `DomainError(409)` で止まる（`message_dispatches.idempotency_key` の UNIQUE 制約）
- 省略すると冪等性チェックは行わない（互換のため任意）。**新しく作る送信 UI・バッチでは必ず渡す**。UI なら送信フォームを開くたびに `crypto.randomUUID()` で発行し、同じフォームからの再送信（二度押し・通信エラー後の再試行）では同じキーを使う
- バッチの再実行で送信済みの対象を除くには `messagingService.findExistingIdempotencyKeys(keys)` を使う（1 クエリでページ単位に判定できる）。キーの行は送信前に作られるので、送信に失敗したジョブも「存在する」側に入る
- 並走した別の実行が先に送った場合も 409 になるので、呼び出し側は 409 を「送信済み」として扱える

実例: wallet の失効予告 cron（`src/features/core/wallet/services/server/notification/`）は対象ごとに決まったキーを作り、`findExistingIdempotencyKeys` で送信済みを除いたうえで、409 を `alreadySent` として数えている。

---

## 記録されるもの

### message_dispatches（送信ジョブ 1 件 = 1 行）

1 回の `send` / `bulkSend` で 1 行。本文はここに 1 度だけ保存するので、bulk でも受信者の数だけ本文が重複しない。

| カラム | 意味 |
|---|---|
| `status` | `processing`（送信前に INSERT）→ `completed`（送り終えて件数確定） |
| `idempotency_key` | 冪等性キー（UNIQUE、NULL は衝突しない） |
| `channels` | 使ったチャネル |
| `email_subject` / `email_body` | `email` を使ったときだけ |
| `notification_title` / `notification_body` | `inApp` を使ったときだけ |
| `recipient_count` | 重複排除後の対象人数 |
| `email_success_count` / `email_failed_count` | メールの成功・失敗数 |
| `notification_created` | `null` = 通知チャネル未使用、`true` = 作成、`false` = 試行して失敗 |
| `source` | 送信経路の識別子 |
| `actor_id` / `actor_type` | 送信者（監査コンテキストから自動取得） |
| `reason` / `metadata` | 任意の送信理由・付加情報 |
| `completed_at` | `completed` になった時刻 |

書き込みの順番が二重送信防止の要になっている。

1. 送信の**前**に `status='processing'` で INSERT する。どこで異常終了しても「送信が走ったかもしれない」痕跡が残る
2. 送り終えたら件数と `status='completed'` を UPDATE する。この UPDATE が失敗しても throw しない（メールは送信済みなので、500 を返すと呼び出し側が再実行して二重送信になる）

`processing` のまま残っている行は、異常終了の痕跡でありメールが送られている可能性がある。再送する前に audit_logs で実際の結果を確かめること。

### audit_logs（受信者 1 人 = 1 行）

「このユーザーにいつ何を送ったか」は audit_logs で追う。

| action | 条件 |
|---|---|
| `messaging.message.sent` | 少なくとも 1 チャネルで成功 |
| `messaging.message.failed` | 試行したすべてのチャネルで失敗 |

- `targetType: "user"`、`targetId` と `subjectUserId` は受信者の ID。ユーザー詳細の UserActivityTimeline（`subject_user_id` で集約）に出る
- `metadata` = `{ dispatchId, source, channels: { email, inApp } }`。`dispatchId` で message_dispatches の本文に辿れる
- 保持期間は既定 730 日（通常の監査ログより長い）
- `bestEffort: true` で記録する。INSERT に失敗しても送信は止めず、dead-letter に退避する

---

## 新しい送る口（sendMessage / sendMessageToMany）

連絡の定義（`messages/<名前>.ts` の `defineMessage`）を受けて送る口。古い `send` / `bulkSend` は連絡を移し終えたら消す（新しい名前はそのまま残る）。

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

1. 生成の一覧（`messageRegistry`）の上書きを `applyMessageOverride` で重ね、`validateMessageDefinition` で検査（誤りは 500、`enabled: false` は回を作らず `status: "disabled"`）
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

まだ効かないもの（後の指令）: 配信停止の好み・宛先の停止・間引き（throttle）、全員・ロール宛てのお知らせの共有の 1 行。受信者ごとの監査ログは書かない（管理者の操作の監査は管理の指令）。

処理の値（`config.ts`、上書き `src/config/features/messaging.config.ts`）: `smallSendMaxRecipients` 100 / `inRequestBatchSize` 50 / `requiredRetry` 3 回（待ち 200ms・1000ms）/ `transientRetry` 初回を含め 5 回・60 秒 × 4 の累乗 / `expandChunkSize` 500

## 上流の経路の項目（channels/）

経路の受け口（`extensionPoints.ts` の `channels`）に上流が出す 3 本。fork の経路（push・SMS など）も同じ形で `channels/<名前>.ts` に足す。項目の形: `src/lib/messaging/README.md`「受け口の項目」。

- `email`（`channels/email/`）: 宛先 = `users.email`（削除済みを除く）。既定の描き方（`view.tsx`: 欄 subject・preheader・heading・paragraphs・cta・footer を lib/mail の枠と部品で、色は `MAIL_THEME_COLORS`）で描き、`lib/mail` の `send()` へ（冪等の鍵 = 配達の id）。`MailSendError` の分類（transient / permanent / unknown）をそのまま結果にし、それ以外の例外は unknown
  - 描画結果に React の「クライアントで描き直す」印（`<!--$!-->`・`$RX`）があれば送らず permanent（`render_fallback`）。部品が描画中に投げると `@react-email/render` は投げずにほぼ空のメールを返すため（L2.1、`fallback.ts`）
  - 連絡ごとの描き方の切り替え（`messages/views/<名前>.tsx`）はまだ届かない（経路の項目に連絡の鍵が渡らない）。連絡を移す指令で足す
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
- `messaging-retention`（`45 18 * * *` UTC、毎日）: `retention` の日数を過ぎた行を `FOR UPDATE SKIP LOCKED` の束で消す。事件 30 日 / 配達 90 日（`queued`・`sending` は残す）/ 回 730 日（お知らせ `message_inbox_items` が参照する回と `processing`・`scheduled` の回は残す。消す前に `idempotency_key` を `message_idempotency_keys` へ移す → 送る口の重複の確かめは両方の表を見る）/ 移した鍵は `idempotencyKeyDays`（既定 null = 無期限）

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

## 送信経路を追加するとき

1. `constants/sources.ts` の `MESSAGING_SOURCES` に識別子を足す。型の上では文字列リテラルも渡せるが、集約と検索のため必ず定数を使う
   - 管理画面の操作が起点: `<画面>.<操作種別>`（例 `bankTransferReview.bulk`）
   - cron などシステムが起点: `<ドメイン>.<機能>.<通知種別>`（例 `wallet.expiration.preNotice`）
   - lower camelCase、ドット区切り
2. 送信 API が要るなら、呼び出し側のドメインに routeFactory でルートを作り、サーバー側から `messagingService` を呼ぶ（このドメインに汎用の送信 API は無い）。管理者向けの送信なら管理者ロールで絞る
3. cron・CLI から呼ぶときは `runAsSystem`（`@/lib/audit`）で包む。包まないと受信者単位の監査記録が `AuditContext is not set` で dead-letter 行きになり、通知の送信者種別も `admin` になる
4. 新しい送信 UI・バッチでは `idempotencyKey` を必ず渡す

`MESSAGING_SOURCES` のうち、本テンプレートに該当画面が無いもの（`USER_HUB_DETAIL_SEND` / `SHIPPING_REQUEST_BULK`）は fork が使う送信経路として残している。消すと fork のマージで衝突・ビルドエラーになるので消さない。

既存の呼び出し例:

- `src/features/core/bankTransferReview/services/server/wrappers/bulkSendEmail.tsx` … 管理画面のバルクアクションから `bulkSend`
- `src/features/core/wallet/services/server/notification/` … cron から `send`（`runAsSystem` + 冪等性キー）

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
| `subscribers/` | `subscriber` | `MessageSubscriber` | 送った後の購読(受ける事件・絞り・事件の束の処理、少なくとも 1 回) |

- 今は上流の項目 0 で、一覧は空。読み手(送る口・購読の cron・管理画面)はまだ無く、項目を置いても送信の流れは変わらない。今の送信は上の「使い方」の `messagingService` と定数(`constants/channels.ts`・`constants/sources.ts`)のまま
- 連絡のドメインの作り直しの切り替えで、上流の経路 email・inApp・line もこの受け口の項目になり、定数から付け替える

## 関連

- [notification](../notification/README.md) … `inApp` チャネルの配信先。全体・ロール別のお知らせは notification を直接使う
- [mail](../mail/README.md) … メール送信の土台。システムテンプレートメールはこちらを直接使う
- [auditLog](../auditLog/README.md) … 受信者単位の記録先
