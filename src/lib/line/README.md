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
  ↓ code→token交換 → lineUserId取得 → users.line_user_id に保存
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

`users` テーブルに `line_user_id` カラムが追加されている。
`drizzle-kit push` でスキーマを反映する。

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
import { userService } from "@/features/core/user/services/server/userService";

await userService.unlinkLineAccount(session.userId);
```

### Push通知を送る

```ts
import { pushMessage, textMessage } from "@/lib/line";

// 単一ユーザーへテキスト送信
await pushMessage(user.lineUserId, [
  textMessage("当選おめでとうございます！S賞を獲得しました🎉"),
]);

// 複数メッセージ（最大5件）
await pushMessage(user.lineUserId, [
  textMessage("ご注文の商品が発送されました"),
  textMessage("追跡番号: 1234-5678-9012"),
]);
```

```ts
import { multicast, textMessage } from "@/lib/line";

// 複数ユーザーへ一斉送信（最大500件）
const lineUserIds = users.map((u) => u.lineUserId).filter(Boolean);
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
    const user = await userService.findByLineUserId(event.source.userId!);
    if (user) {
      const balance = await walletService.getBalance(user.id);
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

## userService メソッド

| メソッド | 説明 |
|---------|------|
| `linkLineAccount(userId, lineUserId)` | LINE userId を紐付け（重複時は 409） |
| `unlinkLineAccount(userId)` | LINE 連携を解除 |
| `findByLineUserId(lineUserId)` | LINE userId からユーザー検索 |

## ライブラリ公開API

```ts
import {
  // OAuth
  buildAuthorizationUrl,
  processCallback,

  // Messaging
  pushMessage,
  replyMessage,
  multicast,
  broadcast,
  textMessage,

  // Webhook
  parseWebhookRequest,
  verifySignature,
  filterEvents,

  // Config
  getLineLoginConfig,
  getLineMessagingConfig,
} from "@/lib/line";
```

## 注意事項

- LINE Login チャネルと Messaging API チャネルは**同一プロバイダー配下**でリンクが必要（`bot_prompt` 機能の前提条件）
- `line_user_id` は Messaging API の Push 送信に必要。友だち追加だけではサービスのアカウントと紐付かない
- Push メッセージは月間の無料枠あり（プランにより異なる）。大量送信時は LINE の料金プランを確認
- LIFF（LINE内ブラウザ）を使う場合は、LINE Login チャネルの LIFF タブでアプリを追加登録する
