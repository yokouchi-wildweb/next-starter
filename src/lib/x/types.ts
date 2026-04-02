// src/lib/x/types.ts

// ────────────────────────────────────────
// クライアント設定
// ────────────────────────────────────────

/** OAuth 1.0a のアプリ認証情報 */
export type XAppCredentials = {
  appKey: string;
  appSecret: string;
};

/** OAuth 1.0a のユーザー認証情報 */
export type XUserCredentials = {
  accessToken: string;
  accessSecret: string;
};

/** OAuth 1.0a のフル認証情報（アプリ + ユーザー） */
export type XFullCredentials = XAppCredentials & XUserCredentials;

/** OAuth 2.0 の認証情報 */
export type XOAuth2Credentials = {
  clientId: string;
  clientSecret: string;
};

/** クライアント生成オプション */
export type XClientConfig =
  | { type: "oauth1"; credentials: XFullCredentials }
  | { type: "oauth2-bearer"; bearerToken: string }
  | { type: "oauth2-user"; credentials: XOAuth2Credentials; accessToken: string };

// ────────────────────────────────────────
// OAuth 2.0 PKCE
// ────────────────────────────────────────

/** OAuth 2.0 認可URL生成の結果 */
export type XOAuthAuthorizationResult = {
  url: string;
  codeVerifier: string;
  state: string;
};

/** OAuth 2.0 トークンレスポンス */
export type XOAuthTokenResponse = {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope: string;
};

/** OAuth 2.0 コールバック処理結果 */
export type XOAuthCallbackResult = {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope: string;
};

/** トークン自動リフレッシュの入力 */
export type XTokenSet = {
  accessToken: string;
  refreshToken: string;
  /** トークンの有効期限（Unix timestamp ミリ秒） */
  expiresAt: number;
};

/** トークンリフレッシュ後のコールバックに渡されるデータ */
export type XRefreshedTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

/** getOrRefreshXClient のオプション */
export type XAutoRefreshOptions = {
  /** 保存済みトークン情報 */
  tokens: XTokenSet;
  /** トークンが更新された場合に呼ばれるコールバック（DB更新等） */
  onTokenRefreshed?: (newTokens: XRefreshedTokens) => void | Promise<void>;
  /** 有効期限の何秒前にリフレッシュするか（デフォルト: 300 = 5分） */
  refreshMarginSeconds?: number;
};

/** getOrRefreshXClient の戻り値 */
export type XAutoRefreshResult = {
  client: import("twitter-api-v2").TwitterApi;
  /** トークンが更新されたか */
  refreshed: boolean;
  /** 現在有効なトークン情報 */
  tokens: XTokenSet;
};

// ────────────────────────────────────────
// ツイート操作
// ────────────────────────────────────────

/** ツイート投稿オプション */
export type XPostOptions = {
  /** リプライ先のツイートID */
  replyToTweetId?: string;
  /** 引用ツイートのID */
  quoteTweetId?: string;
  /** メディアID（事前アップロード済み） */
  mediaIds?: string[];
  /** 投票 */
  poll?: {
    options: string[];
    durationMinutes: number;
  };
};

/** ツイート投稿結果 */
export type XPostResult = {
  id: string;
  text: string;
};

// ────────────────────────────────────────
// メディア
// ────────────────────────────────────────

/** メディアアップロードオプション */
export type XMediaUploadOptions = {
  /** メディアのMIMEタイプ */
  mimeType?: string;
  /** メディアカテゴリ（tweet_image, tweet_video, tweet_gif） */
  mediaCategory?: "tweet_image" | "tweet_video" | "tweet_gif";
  /** 代替テキスト（アクセシビリティ） */
  altText?: string;
};

// ────────────────────────────────────────
// Webhook (Account Activity API)
// ────────────────────────────────────────

/** Webhook イベントの共通フィールド */
export type XWebhookEventBase = {
  for_user_id: string;
};

/** ツイート作成イベント */
export type XTweetCreateEvent = XWebhookEventBase & {
  tweet_create_events: {
    id_str: string;
    text: string;
    user: { id_str: string; screen_name: string };
    created_at: string;
    in_reply_to_status_id_str?: string;
    [key: string]: unknown;
  }[];
};

/** フォローイベント */
export type XFollowEvent = XWebhookEventBase & {
  follow_events: {
    type: "follow" | "unfollow";
    target: { id: string; screen_name: string };
    source: { id: string; screen_name: string };
    created_timestamp: string;
  }[];
};

/** ダイレクトメッセージイベント */
export type XDirectMessageEvent = XWebhookEventBase & {
  direct_message_events: {
    type: "message_create";
    id: string;
    created_timestamp: string;
    message_create: {
      target: { recipient_id: string };
      sender_id: string;
      message_data: { text: string; [key: string]: unknown };
    };
  }[];
};

/** Webhook イベント（union） */
export type XWebhookEvent =
  | XTweetCreateEvent
  | XFollowEvent
  | XDirectMessageEvent;

/** CRC チャレンジレスポンス */
export type XCrcChallengeResponse = {
  response_token: string;
};
