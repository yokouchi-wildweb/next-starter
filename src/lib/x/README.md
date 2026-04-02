# X (Twitter) API ライブラリ

`twitter-api-v2` をベースに、X API の認証・投稿・メディアアップロード・Webhook 検証を統一されたインターフェースで提供する基盤ライブラリ。

**設計思想**: `twitter-api-v2` は TypeScript 完全対応の高品質ライブラリのため、全 API を再ラップせず、認証・設定管理をプロジェクト標準に統一しつつ、ダウンストリームが `twitter-api-v2` の全機能にそのままアクセスできる拡張ポイントを残している。

## ディレクトリ構成

```
src/lib/x/
├── index.ts          # re-export（公開API一覧）
├── config.ts         # 環境変数の一元管理
├── client.ts         # クライアントファクトリ（OAuth 1.0a / 2.0 / App-only）
├── types.ts          # プロジェクト固有の型定義
├── constants.ts      # 定数（スコープ、制限値、Cookie名）
├── oauth.ts          # OAuth 2.0 PKCE フロー
├── tweets.ts         # ツイート投稿・削除ヘルパー
├── media.ts          # メディアアップロードヘルパー
├── errors.ts         # エラー型・判別ヘルパー
└── webhook.ts        # Webhook 署名検証・CRC チャレンジ応答
```

## 関連モジュール

X 連携は以下の3レイヤーで構成される（LINE 連携と同じパターン）:

| レイヤー | パス | 役割 |
|---------|------|------|
| ライブラリ | `src/lib/x/` | API ラッパー（本ファイル） |
| ライブラリ | `src/lib/crypto/` | トークン暗号化（AES-256-GCM、汎用） |
| ドメイン | `src/features/core/userXProfile/` | プロフィール + 暗号化トークン保存 |
| ルート | `src/app/api/auth/x/` | OAuth フロー（login / callback / unlink） |

## セットアップ

### 1. X Developer Portal

1. [X Developer Portal](https://developer.x.com/) にアクセスし、Developer アカウントを作成
2. 「Projects & Apps」→「+ Create Project」でプロジェクトを作成
3. プロジェクト内で「+ Add App」でアプリを作成
4. アプリの「Settings」→「User authentication settings」→「Set up」で以下を設定:
   - **App permissions**: `Read and write`（投稿に必要）
   - **Type of App**: `Web App, Automated App or Bot`
   - **Callback URI**: `https://<your-domain>/api/auth/x/callback`（ローカル開発: `http://localhost:3000/api/auth/x/callback`）
   - **Website URL**: アプリの URL
5. 保存すると **Client ID** と **Client Secret** が表示される → `X_OAUTH2_CLIENT_ID` / `X_OAUTH2_CLIENT_SECRET`
6. 「Keys and tokens」タブで以下を生成（メディアアップロード・公式アカウント投稿に必要な場合のみ）:
   - **API Key and Secret** → `X_API_KEY` / `X_API_SECRET`
   - **Access Token and Secret** → `X_ACCESS_TOKEN` / `X_ACCESS_SECRET`（Permissions を `Read and Write` に設定してから生成すること）

### 2. 環境変数

```env
# OAuth 2.0 PKCE（ユーザー認証フロー）
# Developer Portal → App → Keys and tokens → OAuth 2.0 Client ID and Client Secret
X_OAUTH2_CLIENT_ID=
X_OAUTH2_CLIENT_SECRET=

# OAuth 1.0a（メディアアップロード・アプリ公式アカウント投稿に必要な場合のみ）
# Developer Portal → App → Keys and tokens → Consumer Keys / Authentication Tokens
X_API_KEY=
X_API_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_SECRET=

# トークン暗号化キー（AES-256-GCM、64文字の hex）
# 以下のいずれかで生成:
#   import { generateEncryptionKey } from "@/lib/crypto";
#   generateEncryptionKey();
# または:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=
```

### 3. DB マイグレーション

`user_x_profiles` テーブルが新規追加されている（`users` テーブルとは 1:1 リレーション）。
`drizzle-kit push` でスキーマを反映する。

```
user_x_profiles
├── id (uuid, PK)
├── user_id (uuid, FK → users, unique)     ← 1:1
├── x_user_id (text, unique)               ← X のユーザーID
├── username (text, nullable)              ← @スクリーンネーム
├── display_name (text, nullable)
├── profile_image_url (text, nullable)
├── access_token_encrypted (text)          ← AES-256-GCM 暗号化
├── refresh_token_encrypted (text)         ← AES-256-GCM 暗号化
├── token_expires_at (timestamp)           ← 期限管理
├── scopes (text[], nullable)              ← 認可スコープ
├── created_at / updated_at
```

## ダウンストリームでの実装

### ツイートを投稿する

```ts
import { createXUserClient, postTweet } from "@/lib/x";

const client = createXUserClient();
const result = await postTweet(client, "Hello from our app!");
console.log("投稿成功:", result.id);
```

### メディア付きツイート

```ts
import { createXUserClient, uploadMedia, postTweetWithMedia } from "@/lib/x";

const client = createXUserClient();

// 画像をアップロード（代替テキスト付き）
const mediaId = await uploadMedia(client, "/path/to/image.png", {
  altText: "商品の画像",
});

// メディア付きで投稿
await postTweetWithMedia(client, "新商品が入荷しました！", [mediaId]);
```

### Buffer からのメディアアップロード

```ts
import { createXUserClient, uploadMediaFromBuffer, postTweetWithMedia } from "@/lib/x";

const client = createXUserClient();

// 動的に生成した画像を投稿
const imageBuffer = await generateOgImage(data);
const mediaId = await uploadMediaFromBuffer(client, imageBuffer, "image/png");
await postTweetWithMedia(client, "本日の結果", [mediaId]);
```

### リプライ・引用ツイート

```ts
import { createXUserClient, postTweet, buildReplyOptions, buildQuoteOptions } from "@/lib/x";

const client = createXUserClient();

// リプライ
await postTweet(client, "ありがとうございます！", {
  ...buildReplyOptions("1234567890"),
});

// 引用ツイート
await postTweet(client, "こちらの記事がおすすめです", {
  ...buildQuoteOptions("1234567890"),
});

// 投票付きツイート
await postTweet(client, "好きな色は？", {
  poll: { options: ["赤", "青", "緑"], durationMinutes: 60 },
});
```

### ツイートの削除

```ts
import { createXUserClient, deleteTweet } from "@/lib/x";

const client = createXUserClient();
await deleteTweet(client, "1234567890");
```

### OAuth 2.0 PKCE（ユーザー認証フロー）

ユーザーに X アカウントでの認証を求め、そのユーザーとして操作する場合に使用。

```ts
// --- 認可URL生成（ログインボタン押下時） ---
import { buildXAuthorizationUrl, X_SCOPES } from "@/lib/x";

const { url, codeVerifier, state } = buildXAuthorizationUrl(
  "https://example.com/api/auth/x/callback",
  [X_SCOPES.TWEET_READ, X_SCOPES.TWEET_WRITE, X_SCOPES.USERS_READ, X_SCOPES.OFFLINE_ACCESS],
);

// state と codeVerifier を Cookie/セッションに保存してからリダイレクト
```

```ts
// --- コールバック処理 ---
import { exchangeXCodeForToken } from "@/lib/x";

const { client, accessToken, refreshToken, expiresIn } = await exchangeXCodeForToken(
  code,           // クエリパラメータから取得
  codeVerifier,   // Cookie/セッションから復元
  "https://example.com/api/auth/x/callback",
);

// client はそのユーザーとして認証済み
// accessToken, refreshToken を DB に保存
```

```ts
// --- トークンのリフレッシュ ---
import { refreshXToken } from "@/lib/x";

const { client, accessToken, refreshToken: newRefreshToken } = await refreshXToken(savedRefreshToken);
// 新しいトークンで DB を更新
```

```ts
// --- トークンの失効（ログアウト時など） ---
import { revokeXToken } from "@/lib/x";

await revokeXToken(savedAccessToken);
```

### X 連携ボタン（ダウンストリームでの最小実装）

LINE 連携と同じパターン。`redirect_after` で連携後の戻り先を指定する。

```tsx
// マイページ等に設置（POST でリクエスト）
<form action="/api/auth/x/login?redirect_after=/mypage" method="POST">
  <button type="submit">X と連携する</button>
</form>
```

リダイレクト後のクエリパラメータで結果を判定:

| パラメータ | 値 | 意味 |
|-----------|-----|------|
| `x_linked` | `"true"` | 連携成功 |
| `x_link_error` | エラーメッセージ | 連携失敗 |

### X 連携解除

```ts
import { axios } from "@/lib/axios";

export async function unlinkX() {
  return axios.post("/api/auth/x/unlink");
}
```

### userXProfileService

`@/features/core/userXProfile/services/server/userXProfileService` からインポート。

| メソッド | 説明 |
|---------|------|
| `linkXAccount(userId, options)` | X アカウントを紐付け（トークン暗号化、重複時は 409） |
| `unlinkXAccount(userId)` | X 連携解除（X 側 revoke + レコード削除） |
| `findByUserId(userId)` | ユーザーIDから連携プロフィール検索 |
| `findByXUserId(xUserId)` | X userId から連携プロフィール検索 |
| `getValidClient(userId)` | 有効なクライアント取得（期限切れ時は自動リフレッシュ + DB更新） |
| `updateTokens(userId, tokens)` | トークンを暗号化して更新 |

**`getValidClient` の使用例（推奨）:**

```ts
import { userXProfileService } from "@/features/core/userXProfile/services/server/userXProfileService";
import { postTweet } from "@/lib/x";

// ユーザーの代わりに投稿（トークン管理は全て自動）
const { client } = await userXProfileService.getValidClient(userId);
await postTweet(client, "当選おめでとうございます！🎉");
```

### OAuth 2.0 保存済みトークンからクライアント生成

DBに保存したアクセストークンから「そのユーザーとして」操作するクライアントをワンライナーで生成。

```ts
import { createXOAuth2UserClient, postTweet } from "@/lib/x";

// DBから取得したトークンでクライアント生成
const client = createXOAuth2UserClient(user.xAccessToken);
await postTweet(client, "ユーザーとして投稿！");
```

### トークン自動リフレッシュ

アクセストークンの有効期限（通常2時間）をチェックし、期限切れ前なら自動リフレッシュしてクライアントを返す。トークン更新時はコールバックで DB 更新が可能。

```ts
import { getOrRefreshXClient, postTweet } from "@/lib/x";

const { client, refreshed, tokens } = await getOrRefreshXClient({
  tokens: {
    accessToken: user.xAccessToken,
    refreshToken: user.xRefreshToken,
    expiresAt: user.xTokenExpiresAt,  // Unix timestamp（ミリ秒）
  },
  // トークンが更新された場合に DB を更新
  onTokenRefreshed: async (newTokens) => {
    await db.update(users).set({
      xAccessToken: newTokens.accessToken,
      xRefreshToken: newTokens.refreshToken,
      xTokenExpiresAt: newTokens.expiresAt,
    }).where(eq(users.id, user.id));
  },
  // 期限の何秒前にリフレッシュするか（デフォルト: 300秒 = 5分）
  refreshMarginSeconds: 300,
});

// client は常に有効なトークンで認証済み
await postTweet(client, "当選おめでとうございます！");
```

### エラーハンドリング

X API のエラーを分類し、リトライ可能かどうかを判別できる。

```ts
import {
  postTweet,
  toXApiError,
  isXRateLimited,
  isXTokenExpired,
  isXRetryable,
} from "@/lib/x";

try {
  await postTweet(client, text);
} catch (err) {
  const xError = toXApiError(err);

  switch (xError.code) {
    case "rate_limited":
      // xError.retryAfter 秒後にリトライ可能
      console.log(`レート制限: ${xError.retryAfter}秒後にリトライ`);
      break;
    case "token_expired":
      // トークンをリフレッシュして再試行
      break;
    case "suspended":
      // アカウント凍結 — ユーザーに通知
      break;
    case "duplicate":
      // 同一内容の重複投稿
      break;
    case "forbidden":
    case "not_found":
    case "unknown":
      // その他のエラー
      break;
  }

  // または簡易判別ヘルパーで
  if (isXRateLimited(err)) { /* ... */ }
  if (isXTokenExpired(err)) { /* ... */ }
  if (isXRetryable(err)) { /* リトライ可能 */ }
}
```

エラーコード一覧:

| コード | 意味 | リトライ可能 |
|-------|------|-------------|
| `rate_limited` | レート制限（429） | Yes（retryAfter 秒後） |
| `token_expired` | トークン期限切れ/無効（401） | No（リフレッシュ必要） |
| `forbidden` | アクセス拒否（403） | No |
| `suspended` | アカウント凍結（403） | No |
| `duplicate` | 重複投稿 | No |
| `not_found` | リソース未検出（404） | No |
| `unknown` | その他（5xx等） | 5xx の場合 Yes |

### マルチアカウント対応

各関数にカスタム認証情報を渡すことで、複数アカウントを操作可能。

```ts
import { createXUserClient, postTweet } from "@/lib/x";

// アカウントAで投稿
const clientA = createXUserClient({
  accessToken: accountA.accessToken,
  accessSecret: accountA.accessSecret,
});
await postTweet(clientA, "アカウントAからの投稿");

// アカウントBで投稿
const clientB = createXUserClient({
  accessToken: accountB.accessToken,
  accessSecret: accountB.accessSecret,
});
await postTweet(clientB, "アカウントBからの投稿");
```

### twitter-api-v2 の全APIを直接使用

ヘルパーでカバーしていない操作は、クライアントから `twitter-api-v2` の API を直接呼び出せる。

```ts
import { createXUserClient } from "@/lib/x";

const client = createXUserClient();

// タイムライン取得
const timeline = await client.v2.userTimeline(userId);

// ユーザー検索
const user = await client.v2.userByUsername("username");

// いいね
await client.v2.like(myUserId, tweetId);

// フォロー
await client.v2.follow(myUserId, targetUserId);

// ブックマーク
await client.v2.bookmark(tweetId);

// リスト操作
const list = await client.v2.createList({ name: "Tech", private: true });

// ストリーム（フィルター）
const stream = await client.v2.searchStream();
stream.on("data", (tweet) => console.log(tweet));
```

利用可能な全メソッドは [twitter-api-v2 ドキュメント](https://github.com/PLhery/node-twitter-api-v2) を参照。

### Webhook（Account Activity API）

```ts
// --- CRC チャレンジ応答（GET） ---
import { handleCrcChallenge } from "@/lib/x";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const crcToken = searchParams.get("crc_token");

  if (!crcToken) {
    return Response.json({ error: "crc_token is required" }, { status: 400 });
  }

  const response = handleCrcChallenge(crcToken);
  return Response.json(response);
}
```

```ts
// --- Webhook イベント受信（POST） ---
import { parseXWebhookRequest } from "@/lib/x";
import type { XTweetCreateEvent, XFollowEvent, XDirectMessageEvent } from "@/lib/x";

export async function POST(request: Request) {
  const event = await parseXWebhookRequest(request);

  if ("tweet_create_events" in event) {
    const tweetEvent = event as XTweetCreateEvent;
    for (const tweet of tweetEvent.tweet_create_events) {
      console.log(`新しいツイート: ${tweet.text} by @${tweet.user.screen_name}`);
    }
  }

  if ("follow_events" in event) {
    const followEvent = event as XFollowEvent;
    for (const follow of followEvent.follow_events) {
      console.log(`${follow.type}: @${follow.source.screen_name} → @${follow.target.screen_name}`);
    }
  }

  if ("direct_message_events" in event) {
    const dmEvent = event as XDirectMessageEvent;
    for (const dm of dmEvent.direct_message_events) {
      console.log(`DM: ${dm.message_create.message_data.text}`);
    }
  }

  return Response.json({ ok: true });
}
```

## ライブラリ公開API

```ts
import {
  // クライアント生成
  createXClient,           // カスタム設定からクライアント生成
  createXUserClient,       // 環境変数から OAuth 1.0a ユーザークライアント
  createXAppClient,        // 環境変数から App-only クライアント
  createXOAuth2Client,     // 環境変数から OAuth 2.0 クライアント
  createXOAuth2UserClient, // 保存済みトークンからクライアント生成
  getReadWriteClient,      // readWrite 権限クライアント取得
  getReadOnlyClient,       // readOnly 権限クライアント取得

  // OAuth 2.0 PKCE
  buildXAuthorizationUrl,  // 認可URL生成
  exchangeXCodeForToken,   // コード→トークン交換
  refreshXToken,           // トークンリフレッシュ
  revokeXToken,            // トークン失効
  getOrRefreshXClient,     // 期限チェック + 自動リフレッシュ

  // ツイート操作
  postTweet,               // ツイート投稿
  postTweetWithMedia,      // メディア付き投稿
  deleteTweet,             // ツイート削除
  buildReplyOptions,       // リプライオプション構築
  buildQuoteOptions,       // 引用オプション構築

  // メディア
  uploadMedia,             // ファイルパス/Buffer/FileHandle からアップロード
  uploadMediaFromBuffer,   // Buffer からアップロード（MIMEタイプ必須）
  uploadMediaBatch,        // 複数ファイル並列アップロード

  // エラー
  XApiError,               // エラークラス
  toXApiError,             // 任意のエラーを XApiError に変換
  isXApiError,             // XApiError かどうか判定
  isXRateLimited,          // レート制限エラー判定
  isXTokenExpired,         // トークン期限切れ判定
  isXSuspended,            // アカウント凍結判定
  isXRetryable,            // リトライ可能判定

  // Webhook
  verifyXWebhookSignature, // 署名検証（タイミングセーフ）
  handleCrcChallenge,      // CRC チャレンジ応答
  parseXWebhookRequest,    // 署名検証 + ボディパース

  // 設定
  getXAppConfig,           // アプリ認証情報
  getXUserConfig,          // ユーザー認証情報
  getXOAuthConfig,         // OAuth 2.0 認証情報

  // 定数
  X_SCOPES,                // OAuth 2.0 スコープ一覧
  X_MAX_TWEET_LENGTH,      // 280
  X_MAX_IMAGES_PER_TWEET,  // 4
} from "@/lib/x";
```

## API ルート

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/auth/x/login` | OAuth 2.0 PKCE フロー開始。`redirect_after` 必須、`scopes` 任意 |
| GET | `/api/auth/x/callback` | X からの OAuth コールバック（直接呼び出さない） |
| POST | `/api/auth/x/unlink` | X 連携解除（トークン revoke + レコード削除） |

## API料金（2026年2月〜）

| プラン | 月額 | 投稿上限 | 備考 |
|-------|------|---------|------|
| Free | $0 | 500件/月 | 読み取りほぼ不可、実質廃止方向 |
| Pay-Per-Use | 従量 | — | 投稿 $0.010/件、読み取り $0.005/件 |
| Basic | $200 | — | 一般的な開発用途 |
| Pro | $5,000 | — | 大規模利用 |

## セキュリティ

- **トークン暗号化**: `src/lib/crypto/` の AES-256-GCM でアクセストークン・リフレッシュトークンを暗号化して DB に保存。`v1:iv:tag:ciphertext` フォーマットでバージョン管理
- **Webhook 署名検証**: HMAC-SHA256 + タイミングセーフ比較（`timingSafeEqual`）で検証
- **OAuth 2.0 PKCE**: code_verifier による認可コード横取り攻撃の防止
- **CSRF 対策**: OAuth フローの state パラメータ + nonce cookie によるリクエスト偽造防止
- **連携解除時の revoke**: `unlinkXAccount` は X 側のトークン失効も実行（失敗しても解除は続行）
- **環境変数**: 認証情報・暗号化キーは全て環境変数から取得。コードにハードコードしない

## 注意事項

- メディアアップロード（`uploadMedia`）は **OAuth 1.0a 認証が必要**（v1.1 エンドポイントを使用）
- OAuth 2.0 で取得したクライアントではメディアアップロードは不可
- Free Tier は 2026年2月以降 Pay-Per-Use への移行が進んでおり、投稿上限が500件/月に制限
- `twitter-api-v2` のレート制限ハンドリングが必要な場合は `@twitter-api-v2/plugin-rate-limit` の導入を検討
