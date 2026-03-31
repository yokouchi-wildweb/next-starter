// src/lib/line/index.ts

// 設定
export { getLineLoginConfig, getLineMessagingConfig, getLiffId } from "./config";

// OAuth（LINE Login）
export {
  buildAuthorizationUrl,
  exchangeCodeForToken,
  decodeIdToken,
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

// 型
export type {
  LineTokenResponse,
  LineIdTokenPayload,
  LineFriendshipStatusResponse,
  LineMessage,
  LineTextMessage,
  LineFlexMessage,
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
