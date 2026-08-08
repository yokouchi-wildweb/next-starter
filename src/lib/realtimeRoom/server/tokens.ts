// src/lib/realtimeRoom/server/tokens.ts
//
// ルーム用トークンの署名・検証 (jose HS256)。
// 認証セッション (AUTH_JWT_SECRET) とは信頼ドメインが異なるため、
// 専用鍵 REALTIME_ROOM_AUTH_SECRET を使う (責務ごとに鍵を分離する)。

import "server-only";

import { SignJWT, jwtVerify } from "jose";

import { REALTIME_ROOM_CONFIG } from "@/config/app/realtime-room.config";
import { DomainError } from "@/lib/errors";
import { ROOM_TOKEN_KINDS } from "@/lib/realtimeRoom/protocol";

import { getRealtimeRoomEnv } from "./env";

const encoder = new TextEncoder();

/** ブラウザの WebSocket 接続用トークン (短命) を署名する */
export const signRoomClientToken = async (params: {
  ns: string;
  roomId: string;
  userId: string;
}): Promise<string> => {
  const { secret } = getRealtimeRoomEnv();
  return new SignJWT({ kind: ROOM_TOKEN_KINDS.client, ns: params.ns, roomId: params.roomId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(params.userId)
    .setIssuedAt()
    .setExpirationTime(`${REALTIME_ROOM_CONFIG.clientTokenTtlSeconds}s`)
    .sign(encoder.encode(secret));
};

/** Next サーバー → ルームサーバー呼び出し用トークン (短命) を署名する */
export const signRoomServerToken = async (): Promise<string> => {
  const { secret } = getRealtimeRoomEnv();
  return new SignJWT({ kind: ROOM_TOKEN_KINDS.server })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(`${REALTIME_ROOM_CONFIG.serviceTokenTtlSeconds}s`)
    .sign(encoder.encode(secret));
};

export type RoomCallbackContext = {
  ns: string;
  roomId: string;
};

/**
 * ルームサーバー → アプリ API へのコールバック (永続化エスケープハッチ) を検証する。
 * downstream がコールバック受け口の API ルート (access: "custom") を作る際に必ず使うこと。
 *
 * @example
 * export const POST = createApiRoute(
 *   { operation: "POST /api/raid/snapshot", operationType: "write", access: "custom" },
 *   async (req) => {
 *     const ctx = await verifyRoomCallback(req); // 401 fail-closed
 *     ...
 *   },
 * );
 */
export const verifyRoomCallback = async (request: Request): Promise<RoomCallbackContext> => {
  const { secret } = getRealtimeRoomEnv();
  const header = request.headers.get("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : null;
  if (!token) {
    throw new DomainError("コールバックトークンがありません", { status: 401 });
  }
  try {
    const { payload } = await jwtVerify(token, encoder.encode(secret));
    if (payload.kind !== ROOM_TOKEN_KINDS.callback || typeof payload.ns !== "string" || typeof payload.roomId !== "string") {
      throw new Error("invalid claims");
    }
    return { ns: payload.ns, roomId: payload.roomId };
  } catch {
    throw new DomainError("コールバックトークンが無効です", { status: 401 });
  }
};
