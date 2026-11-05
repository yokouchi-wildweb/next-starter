// servers/room/src/core/socketExpiry.ts
//
// WebSocket の寿命 = 接続トークンの期限 (D18: 取り消しが購読者に届くまでの上限を宣言する。クライアントの協力に頼らない)。
// 期限は接続時に attachment へ保存する (hibernation を跨いで残る)。ルームは受信と送信のたびに期限を見て、
// 期限切れのソケットには何も送らず・操作も受けず、ROOM_CLOSE_CODES.tokenExpired で閉じる (./room.ts)。
// 純関数 (Workers の API に触れない)。

import type { VerifiedRoomToken } from "./auth";

/** WebSocket ごとの attachment (hibernation を跨いで保持される) */
export type SocketAttachment = {
  userId: string | null;
  /** 接続トークンの期限 (ミリ秒)。これ以後は状態も操作も通さない */
  expiresAtMs: number;
};

/** 接続時の attachment。期限 (exp) の無いトークンは null = 接続させない (fail-closed) */
export const socketAttachmentFor = (verified: VerifiedRoomToken): SocketAttachment | null =>
  verified.expiresAtMs === null ? null : { userId: verified.subject, expiresAtMs: verified.expiresAtMs };

/** 期限切れか。attachment が無い・期限の無い古い形も期限切れとみなす (fail-closed) */
export const isSocketExpired = (attachment: unknown, nowMs: number): boolean => {
  const expiresAtMs = (attachment as Partial<SocketAttachment> | null)?.expiresAtMs;
  return typeof expiresAtMs !== "number" || nowMs >= expiresAtMs;
};
