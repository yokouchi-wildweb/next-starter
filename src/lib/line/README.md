# LINE連携ライブラリ

既存アカウントに LINE userId を紐付け、Push通知・Bot応答・LIFF などの LINE 機能をサービスに統合するための基盤ライブラリ。

**重要**: LINE を認証プロバイダーとして使うのではなく、Firebase Auth の既存認証はそのまま維持し、ユーザーの `line_user_id` カラムに LINE userId を保存するだけの ID連携方式。

## アーキテクチャ概要

```
ユーザー（ログイン済み）
  ↓ 「LINE連携する」ボタン
GET /api/auth/line/login?redirect_after=/mypage
  ↓ リダイレクト
LINE 認証画面（プロフィール許可 + 友だち追加）
  ↓ ユーザーが許可
GET /api/auth/line/callback?code=xxx&state=yyy
  ↓ nonce検証(CSRF) → code→token交換 → id_token署名検証(LINE Verify API) → users.line_user_id に保存
リダイレクト → /mypage?line_linked=true
```

## セットアップ

### 1. LINE Developers Console

1. [LINE Developers](https://developers.line.biz/) でプロバイダーを作成
2. 同一プロバイダー配下に以下の2チャネルを作成:
   - **LINE Login チャネル** — OAuth + LIFF アプリ登録用
   - **Messaging API チャネル** — Push通知・Webhook・リッチメニュー用
3. Console 上で2つのチャネルをリンク設定（`bot_prompt` 機能に必要）
4. LINE Login チャネルの「コールバックURL」に `https://<your-domain>/api/auth/line/callback` を登録
5. Messaging API チャネルの「Webhook URL」に `https://<your-domain>/api/webhook/line` を登録

### 2. 環境変数

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

### 3. DBマイグレーション

`user_line_profiles` テーブルが新規追加されている（`users` テーブルとは 1:1 リレーション）。
`drizzle-kit push` でスキーマを反映する。

```
user_line_profiles
├── id (uuid, PK)
├── user_id (uuid, FK → users, unique)  ← 1:1
├── line_user_id (text, unique)
├── display_name (text, nullable)
├── picture_url (text, nullable)
├── created_at
└── updated_at
```

## ダウンストリームでの実装

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

```ts
// クライアントサービス
import { axios } from "@/lib/axios"; // ← プロジェクトの規約に合わせる

export async function unlinkLine() {
  // ダウンストリームで API ルートを作成
  return axios.post("/api/auth/line/unlink");
}
```

```ts
// サーバーサービス（API ルート内）
import { userLineProfileService } from "@/features/core/userLineProfile/services/server/userLineProfileService";

await userLineProfileService.unlinkLineAccount(session.userId);
```

### Push通知を送る

```ts
import { pushMessage, textMessage } from "@/lib/line";
import { userLineProfileService } from "@/features/core/userLineProfile/services/server/userLineProfileService";

// LINE連携プロフィールを取得
const lineProfile = await userLineProfileService.findByUserId(user.id);
if (lineProfile) {
  // 単一ユーザーへテキスト送信
  await pushMessage(lineProfile.lineUserId, [
    textMessage("当選おめでとうございます！S賞を獲得しました🎉"),
  ]);
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

`src/app/api/webhook/line/route.ts` の `handleEvent` 関数をダウンストリームで差し替える。

```ts
// src/app/api/webhook/line/route.ts をダウンストリームで上書き
import { replyMessage, textMessage } from "@/lib/line";
import type { LineFollowEvent, LineMessageEvent, LineWebhookEvent } from "@/lib/line";

const handleEvent = async (event: LineWebhookEvent) => {
  switch (event.type) {
    case "follow":
      await handleFollow(event as LineFollowEvent);
      break;
    case "message":
      await handleMessage(event as LineMessageEvent);
      break;
  }
};

async function handleFollow(event: LineFollowEvent) {
  if (!event.replyToken) return;
  await replyMessage(event.replyToken, [
    textMessage("友だち追加ありがとうございます！\nアカウント連携はこちら → https://example.com/mypage"),
  ]);
}

async function handleMessage(event: LineMessageEvent) {
  if (!event.replyToken || event.message.type !== "text") return;

  if (event.message.text === "残高") {
    // LINE userId からユーザーを特定して残高照会
    const lineProfile = await userLineProfileService.findByLineUserId(event.source.userId!);
    if (lineProfile) {
      const balance = await walletService.getBalance(lineProfile.userId);
      await replyMessage(event.replyToken, [
        textMessage(`現在の残高: ${balance} コイン`),
      ]);
    }
  }
}
```

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

await pushMessage(user.lineUserId, [flexMsg]);
```

## API仕様

### GET /api/auth/line/login

LINE Login OAuth フローを開始する。

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| `redirect_after` | Yes | 連携完了後のリダイレクト先パス |
| `bot_prompt` | No | 友だち追加モード（`aggressive` / `normal` / `none`、デフォルト: `aggressive`） |

### GET /api/auth/line/callback

LINE からのOAuthコールバック（直接呼び出さない）。

### POST /api/webhook/line

LINE Platform からの Webhook 受信。`x-line-signature` ヘッダーで HMAC-SHA256 署名検証を行う。

## userLineProfileService メソッド

`@/features/core/userLineProfile/services/server/userLineProfileService` からインポート。

| メソッド | 説明 |
|---------|------|
| `linkLineAccount(userId, lineUserId, options?)` | LINE userId を紐付け（displayName/pictureUrl も保存、重複時は 409） |
| `unlinkLineAccount(userId)` | LINE 連携を解除（レコード物理削除） |
| `findByLineUserId(lineUserId)` | LINE userId から連携プロフィール検索 |
| `findByUserId(userId)` | ユーザーIDから連携プロフィール検索 |

## ライブラリ公開API

```ts
import {
  // OAuth
  buildAuthorizationUrl,
  processCallback,
  verifyIdToken,

  // Messaging（戻り値で送信結果を取得可能）
  pushMessage,
  replyMessage,
  multicast,    // 500件超は自動バッチ分割
  broadcast,
  textMessage,

  // Webhook
  parseWebhookRequest,
  verifySignature,
  filterEvents,

  // Config
  getLineLoginConfig,
  getLineMessagingConfig,
  getLiffId,     // string | undefined（LIFF未使用時は undefined）
} from "@/lib/line";
```

## セキュリティ

- **id_token 署名検証**: LINE の Verify API（POST /oauth2/v2.1/verify）でサーバーサイド検証。自前デコードではなく LINE サーバーが署名・aud・iss・exp を検証する
- **CSRF 対策**: OAuth フロー開始時に nonce を httpOnly cookie に保存し、callback で state 内の nonce と照合。不一致時は `invalid_state` エラーでリダイレクト
- **Webhook 署名検証**: HMAC-SHA256 で x-line-signature ヘッダーを検証

## 注意事項

- LINE Login チャネルと Messaging API チャネルは**同一プロバイダー配下**でリンクが必要（`bot_prompt` 機能の前提条件）
- `line_user_id` は Messaging API の Push 送信に必要。友だち追加だけではサービスのアカウントと紐付かない
- Push メッセージは月間の無料枠あり（プランにより異なる）。大量送信時は LINE の料金プランを確認
- LIFF（LINE内ブラウザ）を使う場合は、LINE Login チャネルの LIFF タブでアプリを追加登録する
