// src/lib/x/index.ts

// 設定
export {
  getXAppConfig,
  getXUserConfig,
  getXOAuthConfig,
  X_API_BASE,
  X_UPLOAD_BASE,
} from "./config";

// クライアントファクトリ
export {
  createXClient,
  createXUserClient,
  createXAppClient,
  createXOAuth2Client,
  createXOAuth2UserClient,
  getReadWriteClient,
  getReadOnlyClient,
} from "./client";

// OAuth 2.0 PKCE
export {
  buildXAuthorizationUrl,
  exchangeXCodeForToken,
  refreshXToken,
  revokeXToken,
  getOrRefreshXClient,
} from "./oauth";

// ツイート操作
export {
  postTweet,
  postTweetWithMedia,
  deleteTweet,
  buildReplyOptions,
  buildQuoteOptions,
} from "./tweets";

// メディアアップロード
export {
  uploadMedia,
  uploadMediaFromBuffer,
  uploadMediaBatch,
} from "./media";

// Webhook
export {
  verifyXWebhookSignature,
  handleCrcChallenge,
  parseXWebhookRequest,
} from "./webhook";

// エラー型・判別ヘルパー
export {
  XApiError,
  toXApiError,
  isXApiError,
  isXRateLimited,
  isXTokenExpired,
  isXSuspended,
  isXRetryable,
} from "./errors";

// 定数
export {
  X_OAUTH_STATE_COOKIE,
  X_OAUTH_CODE_VERIFIER_COOKIE,
  X_FREE_TIER_MONTHLY_POST_LIMIT,
  X_PAY_PER_USE_POST_COST,
  X_PAY_PER_USE_READ_COST,
  X_MAX_TWEET_LENGTH,
  X_MAX_IMAGES_PER_TWEET,
  X_SCOPES,
} from "./constants";

// 型
export type {
  XAppCredentials,
  XUserCredentials,
  XFullCredentials,
  XOAuth2Credentials,
  XClientConfig,
  XOAuthAuthorizationResult,
  XOAuthTokenResponse,
  XOAuthCallbackResult,
  XPostOptions,
  XPostResult,
  XMediaUploadOptions,
  XWebhookEventBase,
  XTweetCreateEvent,
  XFollowEvent,
  XDirectMessageEvent,
  XWebhookEvent,
  XCrcChallengeResponse,
  XTokenSet,
  XRefreshedTokens,
  XAutoRefreshOptions,
  XAutoRefreshResult,
} from "./types";

export type { XApiErrorCode } from "./errors";

// twitter-api-v2 の主要型を re-export（ダウンストリームが直接利用可能）
export type {
  TwitterApi,
  TwitterApiReadOnly,
  TwitterApiReadWrite,
  TweetV2,
  UserV2,
  SendTweetV2Params,
  TweetV2PostTweetResult,
  TUploadableMedia,
  EUploadMimeType,
} from "twitter-api-v2";
