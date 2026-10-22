# messaging ドメイン

管理者・システムから「特定のユーザーに向けて」送るメッセージ（メール / サービス内通知）の送信窓口。送信そのものに加えて、送信ジョブ単位の記録（`message_dispatches`）と受信者単位の監査ログ（`audit_logs`）を必ず残す。

**ユーザー宛の任意メッセージは必ず `messagingService.send` / `bulkSend` を経由する**（CLAUDE.md PROHIBITED）。各呼び出し元が `lib/mail` の `send()` を直接呼ぶと、受信者単位の記録や本文の保存が漏れる（実際に過去に漏れた）。`lib/mail` を直接使ってよいのは、パスワードリセット・メール認証・登録などのシステムテンプレートメールだけ。

UI・API ルートは持たない。送信画面や送信 API は呼び出し側（各ドメインの wrappers、fork の `_components/` など）が用意し、サーバー側からこのサービスを呼ぶ。

---

## ディレクトリ構成

```
src/features/core/messaging/
├── index.ts                     # 定数と型のみ再エクスポート（サービスは出さない）
├── constants/
│   ├── channels.ts              # MESSAGING_CHANNELS（email / inApp）
│   ├── sources.ts               # MESSAGING_SOURCES（送信経路の識別子）
│   ├── actions.ts               # MESSAGING_AUDIT_ACTIONS（監査 action 名）
│   └── limits.ts                # 文字数上限・バルクのチャンクサイズ
├── entities/
│   ├── drizzle.ts               # message_dispatches テーブル
│   ├── schema.ts                # Zod（MessagingSendInputSchema / MessagingBulkSendInputSchema）
│   └── model.ts                 # 入出力の型
└── services/server/
    ├── messagingService.ts      # 公開 API（send / bulkSend / findExistingIdempotencyKeys）
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

## 関連

- [notification](../notification/README.md) … `inApp` チャネルの配信先。全体・ロール別のお知らせは notification を直接使う
- [mail](../mail/README.md) … メール送信の土台。システムテンプレートメールはこちらを直接使う
- [auditLog](../auditLog/README.md) … 受信者単位の記録先
