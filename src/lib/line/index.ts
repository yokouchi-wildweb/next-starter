// src/lib/line/index.ts

// 設定
export { getLineLoginConfig, getLineMessagingConfig, getLiffId } from "./env";

// OAuth（LINE Login）
export {
  buildAuthorizationUrl,
  exchangeCodeForToken,
  verifyIdToken,
  getFriendshipStatus,
  processCallback,
} from "./oauth";

// OAuth の state と nonce cookie（CSRF 対策。新しい LINE ログインの route も使う）
export {
  issueOAuthState,
  verifyOAuthState,
  LINE_OAUTH_STATE_MAX_AGE_SECONDS,
} from "./oauthState";
export type {
  IssueOAuthStateInput,
  IssueOAuthStateResult,
  LineOAuthNonceCookie,
  OAuthStateCookieReader,
  VerifyOAuthStateInput,
  VerifyOAuthStateResult,
} from "./oauthState";

// Messaging API
export {
  textMessage,
  pushMessage,
  replyMessage,
  multicast,
  broadcast,
} from "./messagingApi";

// Webhook
export {
  verifySignature,
  parseWebhookRequest,
  filterEvents,
} from "./webhook";

// 定数
export { LINE_OAUTH_NONCE_COOKIE, LINE_MULTICAST_MAX_RECIPIENTS } from "./constants";

// 型
export type {
  LineTokenResponse,
  LineIdTokenPayload,
  LineFriendshipStatusResponse,
  LineMessage,
  LineTextMessage,
  LineImageMessage,
  LineVideoMessage,
  LineAudioMessage,
  LineStickerMessage,
  LineFlexMessage,
  LineTemplateMessage,
  LineSendMessageResponse,
  LinePushMessageRequest,
  LineReplyMessageRequest,
  LineWebhookEvent,
  LineWebhookEventBase,
  LineFollowEvent,
  LineUnfollowEvent,
  LineMessageEvent,
  LineWebhookBody,
  LineLinkResult,
} from "./types";
