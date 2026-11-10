# lib/mail

メールの送信（Resend / SendGrid）と React Email のテンプレートの入口。

- 入口: `@/lib/mail`（`send`・`createMailTemplate`・`MailSendError` と型）
- 管理者から利用者への連絡は `messagingService.send` / `bulkSend` を使う（受信者ごとの記録が残る）。`send()` を直に呼ぶのはシステムのテンプレートのメール（パスワードの再設定・確認・登録）だけ（CLAUDE.md PROHIBITED）

## プロバイダーの切り替え

環境変数 `MAIL_PROVIDER` で選ぶ。

- `resend`（既定）: `RESEND_API_KEY` が要る
- `sendgrid`: `SENDGRID_API_KEY` が要る

送信元は `from` / `fromName` で渡す。省略時は `businessConfig.mail.defaultFrom` / `defaultFromName`。

## send()

```ts
import { send, MailSendError } from "@/lib/mail";

const { provider, providerMessageId } = await send({
  to: "user@example.com",
  subject: "件名",
  react: <SomeEmail />,
  headers: { "List-Unsubscribe": "<https://example.com/unsubscribe>" },
  idempotencyKey: deliveryId,
});
```

### 戻り値

`{ provider, providerMessageId }`

- `provider`: 送ったプロバイダー（`"resend"` | `"sendgrid"`）
- `providerMessageId`: プロバイダーの id。得られないときは `null`
  - Resend: 応答の `data.id`（webhook の事件の `email_id` と同じ）
  - SendGrid: 応答ヘッダ `X-Message-Id`。要求単位の id で、webhook の事件の `sg_message_id` はこれで始まる（同一ではない）

### headers

追加のメールヘッダ。両プロバイダーへそのまま渡す（List-Unsubscribe など）。SendGrid は `x-sg-id`・`dkim-signature`・`subject` などを上書きできない。

### idempotencyKey

送り直しで二重に送らないための鍵（配信の記録の id を渡す想定）。

- Resend: `Idempotency-Key` として渡す。24 時間保持。同じ鍵で同じ中身なら送り直さず同じ応答を返す。同じ鍵で中身が違えば 409 `invalid_idempotent_request`
- SendGrid: 同じ仕組みが無いので**捨てる**。SendGrid で送り直す側は、自分で重複を防ぐ

## 失敗の分類（MailSendError）

失敗は `MailSendError`（`Error` を継ぐ）で投げる。`message` は「メール送信に失敗しました（<provider>）: …」。

- `kind`
  - `transient`（一時）: 接続できなかった（ECONNREFUSED・ENOTFOUND など）・429・5xx・Resend の処理中の冪等の 409（`concurrent_idempotent_requests`）。時間を置いて送り直してよい
  - `permanent`（恒久）: 429 以外の 4xx（宛先不正・送信元不正・冪等の鍵の中身違いなど）・SDK が送信前に止めた入力の誤り。送り直しても通らない
  - `unknown`（受付不明）: 応答が得られず、受け付けられたか分からない（タイムアウト・接続の切断・Resend の fetch の失敗）。送り直すなら冪等の鍵を付ける
- `provider`: 失敗したプロバイダー
- `status`: HTTP 状態（応答が無いときは `null`）
- `cause`: プロバイダーの元の誤り

## createMailTemplate

件名・テンプレートの部品・テスト用の props をまとめ、`Template.send(to, props, options?)` で送る。戻り値は返さない（`Promise<void>`）。

## テスト

`pnpm test src/lib/mail/send.test.ts`（外部通信なし。client を偽物に差し替える）
