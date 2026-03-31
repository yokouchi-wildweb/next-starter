// src/lib/line/types.ts

// ────────────────────────────────────────
// LINE Login OAuth
// ────────────────────────────────────────

/** LINE Login のトークンレスポンス */
export type LineTokenResponse = {
  access_token: string;
  expires_in: number;
  id_token: string;
  refresh_token: string;
  scope: string;
  token_type: "Bearer";
};

/** id_token をデコードした結果（必要なクレームのみ） */
export type LineIdTokenPayload = {
  /** LINE userId */
  sub: string;
  /** 表示名 */
  name?: string;
  /** プロフィール画像URL */
  picture?: string;
  /** メールアドレス（scope に email が含まれる場合） */
  email?: string;
};

/** 友だちステータスレスポンス */
export type LineFriendshipStatusResponse = {
  friendFlag: boolean;
};

// ────────────────────────────────────────
// Messaging API
// ────────────────────────────────────────

/** メッセージの種類 */
export type LineMessageType = "text" | "image" | "video" | "audio" | "flex" | "template";

/** テキストメッセージ */
export type LineTextMessage = {
  type: "text";
  text: string;
};

/** Flex メッセージ */
export type LineFlexMessage = {
  type: "flex";
  altText: string;
  contents: Record<string, unknown>;
};

/** Push/Reply で送信可能なメッセージ */
export type LineMessage = LineTextMessage | LineFlexMessage | { type: string; [key: string]: unknown };

/** Push メッセージのリクエスト */
export type LinePushMessageRequest = {
  to: string;
  messages: LineMessage[];
};

/** Reply メッセージのリクエスト */
export type LineReplyMessageRequest = {
  replyToken: string;
  messages: LineMessage[];
};

// ────────────────────────────────────────
// Webhook
// ────────────────────────────────────────

/** Webhook イベント共通 */
export type LineWebhookEventBase = {
  type: string;
  timestamp: number;
  source: {
    type: "user" | "group" | "room";
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  replyToken?: string;
  mode: "active" | "standby";
};

/** フォローイベント */
export type LineFollowEvent = LineWebhookEventBase & {
  type: "follow";
};

/** アンフォローイベント */
export type LineUnfollowEvent = LineWebhookEventBase & {
  type: "unfollow";
};

/** メッセージイベント */
export type LineMessageEvent = LineWebhookEventBase & {
  type: "message";
  message: {
    type: string;
    id: string;
    text?: string;
    [key: string]: unknown;
  };
};

/** Webhook イベント */
export type LineWebhookEvent = LineFollowEvent | LineUnfollowEvent | LineMessageEvent | LineWebhookEventBase;

/** Webhook リクエストボディ */
export type LineWebhookBody = {
  destination: string;
  events: LineWebhookEvent[];
};

// ────────────────────────────────────────
// LINE連携コールバック結果
// ────────────────────────────────────────

/** LINE連携コールバックの処理結果 */
export type LineLinkResult = {
  lineUserId: string;
  displayName?: string;
  pictureUrl?: string;
  friendshipStatusChanged: boolean;
  isFriend: boolean;
};
