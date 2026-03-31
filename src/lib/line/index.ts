// src/lib/line/index.ts

// 設定
export { getLineLoginConfig, getLineMessagingConfig, getLiffId } from "./config";

// OAuth（LINE Login）
export {
  buildAuthorizationUrl,
  exchangeCodeForToken,
  verifyIdToken,
  getFriendshipStatus,
  processCallback,
} from "./oauth";

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
