# LINE連携ライブラリ

## Overview

- 既存アカウントに LINE userId を紐付け、Push通知・Bot応答・LIFF などの LINE 機能をサービスに統合するための基盤ライブラリ
- LINE を認証プロバイダーとして使うのではなく、Firebase Auth の既存認証はそのまま維持し、LINE userId を `user_line_profiles` に保存する ID 連携方式
- 使う時・直す時の決まりは札 .claude/rules/items/lib/line.md にある。この README は使い方と仕組み

```
ユーザー（ログイン済み）
  ↓ 「LINE連携する」ボタン
GET /api/auth/line/login?redirect_after=/mypage
  ↓ リダイレクト
LINE 認証画面（プロフィール許可 + 友だち追加）
  ↓ ユーザーが許可
GET /api/auth/line/callback?code=xxx&state=yyy
  ↓ nonce検証(CSRF) → code→token交換 → id_token署名検証(LINE Verify API) → user_line_profiles に保存
リダイレクト → /mypage?line_linked=true
```

## Usage

### LINE Developers Console

1. [LINE Developers](https://developers.line.biz/) でプロバイダーを作成
2. 同一プロバイダー配下に以下の2チャネルを作成:
   - **LINE Login チャネル** — OAuth + LIFF アプリ登録用
   - **Messaging API チャネル** — Push通知・Webhook・リッチメニュー用
3. Console 上で2つのチャネルをリンク設定（`bot_prompt` 機能に必要）
4. LINE Login チャネルの「コールバックURL」に `https://<your-domain>/api/auth/line/callback` を登録
5. Messaging API チャネルの「Webhook URL」に `https://<your-domain>/api/webhook/line` を登録

### 環境変数

```env
# LINE Login チャネル（OAuth + LIFF）
LINE_LOGIN_CHANNEL_ID=your_channel_id
LINE_LOGIN_CHANNEL_SECRET=your_channel_secret

# LINE Messaging API チャネル（Push通知・Webhook）
LINE_MESSAGING_CHANNEL_ACCESS_TOKEN=your_long_lived_token
LINE_MESSAGING_CHANNEL_SECRET=your_channel_secret

# LIFF アプリID（LINE内ブラウザ用、任意）
LIFF_ID=your_liff_id
```

### DBマイグレーション

表 `user_line_profiles`（`users` と 1:1）。初めて入れるときは `pnpm db:push` で作る。

```
user_line_profiles
├── id (uuid, PK)
├── user_id (uuid, FK → users, unique)  ← 1:1
├── line_user_id (text, unique)
├── display_name (text, nullable)
├── created_at
└── updated_at
```

プロフィール画像は持たない(URL も画像も)。

### LINE連携ボタン

最小実装はリンク1つ。`redirect_after` で連携後の戻り先を指定する。

```tsx
// マイページ等に設置
<a href="/api/auth/line/login?redirect_after=/mypage">
  LINE と連携する
</a>
```

リダイレクト後のクエリパラメータで結果を判定:

| パラメータ | 値 | 意味 |
|-----------|-----|------|
| `line_linked` | `"true"` | 連携成功 |
| `line_friend` | `"true"` | 友だち追加済み |
| `line_link_error` | エラーメッセージ | 連携失敗 |

```tsx
"use client";

import { useSearchParams } from "next/navigation";

function LineStatusMessage() {
  const searchParams = useSearchParams();

  if (searchParams.get("line_linked") === "true") {
    return <p>LINE連携が完了しました！通知を受け取れるようになりました。</p>;
  }
  if (searchParams.get("line_link_error")) {
    return <p>LINE連携に失敗しました: {searchParams.get("line_link_error")}</p>;
  }
  return null;
}
```

### LINE連携解除

ルート `POST /api/auth/line/unlink`（上流同梱、本人のみ・`createApiRoute` access authenticated）と ClientService を使う。

```ts
// クライアント（UI からは fork のフックで包む。例: useDomainMutation）
import { unlinkLine } from "@/domains/core/userLineProfile/services/client/userLineProfileClient";

await unlinkLine(); // 連携が無ければ 400（normalizeHttpError 済みのエラー）
```

サーバー側の処理は `userLineProfileService.unlinkLineAccount(userId)`（ルートは `ctx.user.userId` を渡す）。

### Push通知を送る

```ts
import { pushMessage, textMessage } from "@/lib/line";
import { userLineProfileService } from "@/domains/core/userLineProfile/services/server/userLineProfileService";

// LINE連携プロフィールを取得
const lineProfile = await userLineProfileService.findByUserId(user.id);
if (lineProfile) {
  // 単一ユーザーへテキスト送信
  await pushMessage(lineProfile.lineUserId, [
    textMessage("当選おめでとうございます！S賞を獲得しました🎉"),
  ]);
}
```

### 失敗の型と再試行の鍵（X-Line-Retry-Key）

- 送信の失敗は `LineApiError`（`status`: HTTP の状態、応答なしは `null` / `retryable`: 429・5xx・応答なし = `true`、他の 4xx = `false` / `body`: LINE の誤りの本文）。`message` は前と同じ文（`LINE Messaging API エラー: <status> <body>`）。push・reply・multicast・broadcast とも同じ
- `pushMessage(to, messages, { retryKey })` で `X-Line-Retry-Key` を付ける。鍵は UUID の形が要るので `lineRetryKey(呼び手の鍵)` で作る（固定の名前空間の UUID v5。同じ鍵 → 同じ UUID）。呼び手の鍵は送り直しの間で変わらない値（例: 配達の id）
- 鍵を付けた push の 409（同じ鍵の要求を LINE が受付済み）は成功として、その応答の本文（`sentMessages`）を返す。鍵の無い 409 は `LineApiError`
- LINE が鍵を覚えるのは 24 時間（過ぎると同じ鍵でも新しい送信になる）。鍵があれば応答なしの失敗も送り直して二重にならない

```ts
import { lineRetryKey, LineApiError, pushMessage, textMessage } from "@/lib/line";

try {
  await pushMessage(lineUserId, [textMessage("お知らせ")], { retryKey: lineRetryKey(deliveryId) });
} catch (error) {
  if (error instanceof LineApiError && error.retryable) {
    // 時間を置いて同じ鍵で送り直す
  }
}
```

```ts
import { multicast, textMessage } from "@/lib/line";

// 複数ユーザーへ一斉送信（500件超は自動バッチ分割）
const profiles = await userLineProfileService.list();
const lineUserIds = profiles.map((p) => p.lineUserId);
await multicast(lineUserIds, [
  textMessage("新しいガチャマシンが公開されました！"),
]);
```

```ts
import { broadcast, textMessage } from "@/lib/line";

// 全友だちへ一斉送信
await broadcast([textMessage("キャンペーン開催中！")]);
```

### Webhook イベント処理

イベントごとの処理は `<ドメイン>/plugs/userLineProfileWebhookHandlers/<名前>.ts` に置き、`pnpm generate extensions` する(上流の項目は 0)。route は署名検証・振り分け・応答だけを持つ。同じ `eventType` の項目は一覧の順に全部呼ばれ、1 つ失敗してもログに残して続行する(LINE へは 200)。

```ts
// <ドメイン>/plugs/userLineProfileWebhookHandlers/follow.ts
import type { LineWebhookEventHandler } from "@/domains/core/userLineProfile/types/webhook";
import { replyMessage, textMessage } from "@/lib/line";

export const handler: LineWebhookEventHandler = {
  eventType: "follow",
  handle: async (event) => {
    if (!event.replyToken) return;
    await replyMessage(event.replyToken, [
      textMessage("友だち追加ありがとうございます！\nアカウント連携はこちら → https://example.com/mypage"),
    ]);
  },
};
```

メッセージのイベントは `event as LineMessageEvent` で絞る。

### Flex メッセージ（リッチなカード型通知）

```ts
import { pushMessage } from "@/lib/line";
import type { LineFlexMessage } from "@/lib/line";

const flexMsg: LineFlexMessage = {
  type: "flex",
  altText: "当選通知",
  contents: {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: "🎉 S賞当選！", weight: "bold", size: "xl" },
        { type: "text", text: "限定フィギュア", size: "md", color: "#666666" },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          action: { type: "uri", label: "詳細を見る", uri: "https://example.com/mypage" },
          style: "primary",
        },
      ],
    },
  },
};

await pushMessage(lineProfile.lineUserId, [flexMsg]); // lineProfile = userLineProfileService.findByUserId の結果
```

## API

### ルート

#### GET /api/auth/line/login

LINE Login OAuth フローを開始する。

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| `redirect_after` | Yes | 連携完了後のリダイレクト先パス |
| `bot_prompt` | No | 友だち追加モード（`aggressive` / `normal` / `none`、デフォルト: `aggressive`） |

#### GET /api/auth/line/callback

LINE からのOAuthコールバック（直接呼び出さない）。

#### POST /api/webhook/line

LINE Platform からの Webhook 受信。`x-line-signature` ヘッダーで HMAC-SHA256 署名検証を行う。

### userLineProfileService

`@/domains/core/userLineProfile/services/server/userLineProfileService` からインポート。

| メソッド | 説明 |
|---------|------|
| `linkLineAccount(userId, lineUserId, options?)` | LINE userId を紐付け（渡された displayName を保存、渡さなければ null。重複時は 409） |
| `unlinkLineAccount(userId)` | LINE 連携を解除（レコード物理削除） |
| `findByLineUserId(lineUserId)` | LINE userId から連携プロフィール検索 |
| `findByUserId(userId)` | ユーザーIDから連携プロフィール検索 |

### ライブラリ公開API

```ts
import {
  // OAuth
  buildAuthorizationUrl,
  processCallback,      // code の交換 → id_token の検証 → 友だちの状態をまとめて
  exchangeCodeForToken,
  verifyIdToken,
  getFriendshipStatus,
  issueOAuthState,   // state と nonce cookie を作る（CSRF 対策）
  verifyOAuthState,  // callback で state と cookie の nonce を照合する

  // Messaging（戻り値で送信結果を取得可能）
  pushMessage,
  replyMessage,
  multicast,    // 500件超は自動バッチ分割
  broadcast,
  textMessage,
  lineRetryKey,  // X-Line-Retry-Key の UUID を呼び手の鍵から作る
  LineApiError,  // 送信の失敗（status・retryable・body）
  isRetryableLineStatus, // 状態が送り直してよい物か（429・5xx・応答なし）

  // Webhook
  parseWebhookRequest,
  verifySignature,
  filterEvents,

  // Config
  getLineLoginConfig,
  getLineMessagingConfig,
  getLiffId,     // string | undefined（LIFF未使用時は undefined）

  // 定数
  LINE_OAUTH_NONCE_COOKIE,
  LINE_OAUTH_STATE_MAX_AGE_SECONDS,
  LINE_MULTICAST_MAX_RECIPIENTS, // multicast の 1 回の上限（500）
} from "@/lib/line";
```

- 型: メッセージ(`LineMessage`・`LineTextMessage`・`LineFlexMessage` ほか)・Webhook の事象(`LineWebhookEvent` ほか)・応答・state の入出力(`IssueOAuthStateInput` ほか)・`PushMessageOptions`

### OAuth の state と nonce cookie（issueOAuthState / verifyOAuthState）

LINE Login の行き（認可 URL へのリダイレクト）と帰り（callback）の CSRF 対策。上流の `/api/auth/line/login`・`/callback` もこれを使う。
fork が自分の LINE ログイン（新規登録・ログインの流れ）を足すときも使える。

```ts
import { buildAuthorizationUrl, issueOAuthState, verifyOAuthState } from "@/lib/line";

// 行き: state を認可 URL に、nonce を httpOnly cookie に
const { state, nonceCookie } = issueOAuthState({ redirectAfter, cookieName: "__line_signin_nonce" });
const response = NextResponse.redirect(buildAuthorizationUrl(callbackUrl, state));
response.cookies.set(nonceCookie);

// 帰り: 照合。失敗なら戻り先を信用せず "/" へ
const verified = verifyOAuthState({ state: req.nextUrl.searchParams.get("state"), cookies: req.cookies, cookieName: "__line_signin_nonce" });
if (!verified.ok) { /* invalid_state で "/" へ。cookie は消す */ }
// verified.redirectAfter = 同一オリジンのパスに sanitize 済み
```

- state = base64url の JSON `{ nonce, redirectAfter }`、nonce = ランダム 16 byte の hex
- cookie: `httpOnly`・`sameSite: lax`・`path: /`・10 分（`LINE_OAUTH_STATE_MAX_AGE_SECONDS`）・`secure` は段階が development 以外のとき（`!isDevelopment()`、`@/lib/appEnv`）
- `cookieName` の既定は `LINE_OAUTH_NONCE_COOKIE`（上流の連携の流れ）。別の流れ（ログインなど）は別の名前にすれば同時に進んでも互いの nonce を上書きしない
- 照合の後（成功・失敗とも）の cookie の削除は呼び手の `response.cookies.delete(cookieName)`
- 利用者を引く・作る・セッションを出すのは auth README「新しい認証手段」（createFromProvider → establishSession）

## Internals

- **id_token 署名検証**: LINE の Verify API（POST /oauth2/v2.1/verify）でサーバーサイド検証。自前デコードではなく LINE サーバーが署名・aud・iss・exp を検証する
- **CSRF 対策**: OAuth フロー開始時に nonce を httpOnly cookie に保存し、callback で state 内の nonce と照合（`issueOAuthState` / `verifyOAuthState`）。不一致時は `invalid_state` エラーでリダイレクト
- **Webhook 署名検証**: HMAC-SHA256 で x-line-signature ヘッダーを検証

- LINE Login チャネルと Messaging API チャネルは**同一プロバイダー配下**でリンクが必要（`bot_prompt` 機能の前提条件）
- `line_user_id` は Messaging API の Push 送信に必要。友だち追加だけではサービスのアカウントと紐付かない
- Push メッセージは月間の無料枠あり（プランにより異なる）。大量送信時は LINE の料金プランを確認
- LIFF（LINE内ブラウザ）を使う場合は、LINE Login チャネルの LIFF タブでアプリを追加登録する

## Verification

- `pnpm test src/lib/line`(OAuth・state と nonce・Messaging・Webhook)
