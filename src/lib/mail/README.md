# lib/mail

メールの送信（Resend / SendGrid）と、メールの見た目の部品（React Email）の入口。

- 入口: `@/lib/mail`（`send`・`MailSendError`・webhook・枠と部品・色の生成物 `MAIL_THEME_COLORS` と型）
- 利用者へのメールは連絡の定義（`messages/<名前>.ts` + `views/<名前>.tsx`）を送る口 `messagingService.sendMessage` / `sendMessageToMany` で送る（回・配達の記録・配信停止）。`send()` を直に呼ぶのはメールの経路の項目（src/features/core/messaging/channels/email）だけ。書き方: src/lib/messaging/README.md

## プロバイダーの切り替え

環境変数 `MAIL_PROVIDER` で選ぶ。

- `resend`（既定）: `RESEND_API_KEY` が要る
- `sendgrid`: `SENDGRID_API_KEY` が要る

送信元は `from` / `fromName` で渡す。省略時は設定の `defaultFrom` / `defaultFromName`（既定 `config.ts`、上書き `src/config/lib/mail.config.ts` = `@lib-config/mail`。上流の上書きは `@/business` の `mail` を写す）。

## セットアップ（Resend）

1. [Resend](https://resend.com) でアカウントを作り、API キーを発行する（`RESEND_API_KEY`、.env.development / .env.production）
2. Resend のコンソールで送信元のドメインを足し、表示される DNS レコード（DKIM・SPF など）をドメインの DNS に足して「Verify」で認証する
3. 送信元のアドレスと名前は `src/config/lib/mail.config.ts` の `defaultFrom` / `defaultFromName`（上流は `@/business` の `mail` を写す。環境変数は API キーだけ）

届かないとき: コンソールでドメインが Verified か・迷惑メールのフォルダ・コンソールの Emails の誤りを見る。DNS の伝播は 24〜48 時間かかることがあり、直後は Verified と Pending を行き来する。

テスト送信: `pnpm ops mail test-send`（対話式。接続確認のメールか、連絡の一覧 messageRegistry のメールの欄を持つ連絡を見本の値で描いて送る。対話なし: `-- --to=<アドレス> --message=<連絡の鍵 | simple>`。送る口は通さない）

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

### 本文の渡し方（react か html のどちらか片方）

- `react: ReactElement`: React Email の部品。provider の側で html に描く（Resend は SDK が、SendGrid は `send()` が `@react-email/render` で描く）
- `html: string`（+ 任意の `text: string`）: 描き終えた本文。そのまま送り、もう一度描かない。呼び手が描いた結果を検査してから送るとき（メールの経路の項目は描いた html に React のフォールバックの印が無いか見てから、その html を渡す）
- 片方必須は型で表す（`SendMailOptions = SendMailReactOptions | SendMailHtmlOptions`、もう片方の欄は `never`）。`text` は html の時だけ。react の時の text は送らない（今までどおり）

```ts
await send({ to, subject, html, text }); // 描き終えた html を渡す
```

### 戻り値

`{ provider, providerMessageId }`

- `provider`: 送ったプロバイダー（`"resend"` | `"sendgrid"`）
- `providerMessageId`: プロバイダーの id。得られないときは `null`
  - Resend: 応答の `data.id`（webhook の事件の `email_id` と同じ）
  - SendGrid: 応答ヘッダ `X-Message-Id`。要求単位の id で、webhook の事件の `sg_message_id` はこれで始まる（同一ではない）

### headers

追加のメールヘッダ。両プロバイダーへそのまま渡す（List-Unsubscribe など）。SendGrid は `x-sg-id`・`dkim-signature`・`subject` などを上書きできない。

### tags

`tags?: Record<string, string>`（例 `{ delivery_id }`）。Resend は `tags: [{ name, value }]`、SendGrid は `customArgs` で渡し、webhook の事件の `tags` で読み戻す。名前と値は英数字・`_`・`-`（Resend の制約）。

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

## webhook の検証と正規化（lib/mail/webhooks）

provider から届く事件（届いた・開かれた・跳ね返った…）を検証し、共通の形 `MailWebhookEvent` に直す。受け口（route）・秘密の置き場（環境変数）・事件の保存は使う側が持つ。lib は環境変数を読まず、秘密 / 公開鍵は引数で受ける。

```ts
import {
  verifyResendWebhook,
  normalizeResendWebhook,
  verifySendGridWebhook,
  normalizeSendGridWebhook,
  MailWebhookVerifyError,
} from "@/lib/mail";

const rawBody = await request.text(); // 署名は生の本文で検証する（JSON を解析し直した物は渡さない）

// Resend
const events = normalizeResendWebhook(
  verifyResendWebhook({ rawBody, headers: request.headers, secret: resendWebhookSecret }),
);

// SendGrid
const events = normalizeSendGridWebhook(
  verifySendGridWebhook({ rawBody, headers: request.headers, publicKey: sendgridPublicKey }),
);
```

- 失敗は `MailWebhookVerifyError`（`reason` = `missing_header` | `bad_signature` | `stale_timestamp` | `bad_payload`）
- `MailWebhookEvent` = `{ provider, providerMessageId, providerEventId, type, address, occurredAt, raw }`
  - `providerMessageId` は送信時の `send()` の戻り値と同じ値（記録と結ぶ鍵）
  - `providerEventId` は重複の除外の鍵（provider は再試行で同じ事件を何度も送る）
  - `type` = `sent` | `delivered` | `deferred` | `bounced` | `complained` | `opened` | `clicked` | `dropped` | `unsubscribed` | `other`。元の種類名・クリックの URL などは `raw` から読む
  - `bounce` = `hard` | `soft`（`bounced` の時だけ）。Resend は `data.bounce.type` が `Permanent` なら hard（`Transient`・`Undetermined`・無しは soft）、SendGrid は bounce の `type` が `blocked` なら soft・ほかは hard。宛先の停止に入れるのは hard だけ（読み手 messaging）
  - `tags` = 送る時に `send()` の `tags` で付けた値（Resend の `data.tags`、SendGrid の事件の標準でない文字列の欄 = custom_args）

### provider ごとの違い

- Resend
  - 署名: Svix（`svix-id`・`svix-timestamp`・`svix-signature`）。秘密は webhook の設定に出る `whsec_…`。timestamp は既定で前後 5 分まで許す（`toleranceSec`）
  - 本文: 1 本文 = 事件 1 件。`providerEventId` = `svix-id`、`providerMessageId` = `data.email_id`
  - 種類: `email.sent` → sent、`email.delivery_delayed` → deferred、`email.failed` / `email.suppressed` → dropped、メール以外の事件（contact.* など）→ other
  - SDK の `webhooks.verify` は Resend の client（API キー）を要するので使わず、node:crypto で検証する
- SendGrid（Event Webhook）
  - 署名: ECDSA（`X-Twilio-Email-Event-Webhook-Signature`・`-Timestamp`）。公開鍵は Signed Event Webhook を有効にすると出る値（base64 の DER。PEM も受ける）
  - 本文: 事件の配列。`providerEventId` = `sg_event_id`（無い事件は飛ばす）、`providerMessageId` = `sg_message_id` の「.」より前（= 送信時の `X-Message-Id`。非同期のバウンスでは無いことがある）
  - 種類: `processed` → sent、`blocked` → deferred（一時の拒否）、`spamreport` → complained、`unsubscribe` / `group_unsubscribe` → unsubscribed、`group_resubscribe` → other

### 開封・クリック

どちらの provider も計測は provider 側の設定で入れる（Resend はドメインごとで既定は切、SendGrid はアカウントの Tracking の設定）。入れない限り `opened` / `clicked` は届かない。

## メールの枠の部品（lib/mail/frame）

メールの見た目の共通の部品。テンプレートごとに style を写さず、部品を並べて組む。

```tsx
import { createMailParts } from "@/lib/mail";

const m = createMailParts(mailTheme); // 色を束ねた部品(theme を部品ごとに渡す形と同じ HTML)

<m.Frame preview="メールアドレスの確認">
  <m.Heading>メールアドレスの確認</m.Heading>
  <m.Paragraph>以下のボタンを押して、確認を完了してください。</m.Paragraph>
  <m.Button href={url}>メールアドレスを確認する</m.Button>
  <m.Paragraph>ボタンが押せない場合は、以下の URL をブラウザに貼り付けてください。</m.Paragraph>
  <m.Url href={url} />
  <m.Footer>このメールに心当たりがない場合は、無視してください。</m.Footer>
</m.Frame>

// 束ねない形: <MailFrame theme={mailTheme}> <MailHeading theme={mailTheme}>…</MailHeading> …
```

- 部品
  - `MailFrame`: Html・Head・Preview・Body・Container。`theme`（色）・`preview`（受信一覧の下見の文）・`lang`（既定 ja）
  - `MailHeading`（見出し）・`MailParagraph`（段落。`align`・`preWrap`）・`MailButton`（中央寄せのボタン。`tone` = primary | accent）・`MailUrl`（URL のリンク。children を省くと URL を出す）・`MailNote`（注記）・`MailFooter`（最後の注意書き）
  - `MailDivider`（区切り線）・`MailHeader`（ロゴ + 文。ロゴは絶対 URL）・`MailInfoBox`（ラベルと値の箱）
- style の既定値は上流のテンプレート（auth のメール）の値。細かい違いは各部品の `style`（既定に重ねる）で合わせる
- 色: 枠と各部品の `theme`（`MailTheme`、src/styles の palette と同じ鍵）で渡す。部品ごとに渡す手間は `createMailParts(theme)` で省ける（下）。色の値は下の「色の生成物」の `MAIL_THEME_COLORS` を呼び手が渡す
- React の context は使わない: メールはサーバーで描き、`@/lib/mail` はサーバーの module（送る口 → メールの経路 → 描き方）から読まれる。lib に `createContext` を置くと Next の build が落ちる（frame.test.tsx が固定）
- react-email の `render` は描画の誤りを投げず、誤りの印（`server rendering errored`）だけの HTML を返す。部品の誤り（`theme` の渡し忘れなど）は空のメールになりうるので、型検査で止める（`theme` は必須の props）

### 色の生成物（生成区画 lib/mail/generated/）

- `src/lib/mail/generated/themeColors.ts`（`MAIL_THEME_COLORS`、`MailTheme` の鍵と同じ）は `pnpm generate styles` が書く生成物。手で直さない。読むのは入口 `@/lib/mail` から（ファイルを名指ししない）
- 生成元 = `src/styles/core/palette.css`（上流の既定）+ `src/styles/palette.css`（fork の上書き）の `:root` を後勝ちで合成し hex にする。必要な変数が欠ければ書き出す前に失敗する
- メールはダークモードもエリアも持たないので `.dark` / `[data-area]` は読まない。メールにも効かせたい色は `palette.css` の `:root` に書く
- 色を変えたら `pnpm generate styles` を回して生成物をコミットする（build では作り直さない）。書き手 scripts/structure/styles/generate-mail-colors.ts、所有の規則は src/styles/README.md
- 鍵: primary・primaryForeground・secondary・secondaryForeground・muted・mutedForeground・accent・accentForeground・destructive・background・foreground・border（それぞれ `--<名前>` の CSS 変数）

## テスト

`pnpm test src/lib/mail/send.test.ts`（外部通信なし。client を偽物に差し替える）
