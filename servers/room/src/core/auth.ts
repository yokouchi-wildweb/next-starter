// servers/room/src/core/auth.ts
//
// トークン検証・署名 (jose HS256 / REALTIME_ROOM_AUTH_SECRET 共有鍵)。
// - 検証: Next 側が署名した room_client / room_server トークン
// - 署名: Worker → Next API コールバック用の room_callback トークン

import { SignJWT, jwtVerify } from "jose";

import { ROOM_TOKEN_KINDS } from "@/lib/realtimeRoom/protocol";
import type { RoomTokenClaims } from "@/lib/realtimeRoom/protocol";

const encoder = new TextEncoder();

export type VerifiedRoomToken = {
  kind: RoomTokenClaims["kind"];
  /** トークン subject (client トークンではユーザーID) */
  subject: string | null;
  ns: string | null;
  roomId: string | null;
};

/** トークンを検証し、クレームを返す。無効なら null (fail-closed) */
export const verifyRoomToken = async (
  token: string,
  secret: string,
): Promise<VerifiedRoomToken | null> => {
  try {
    const { payload } = await jwtVerify(token, encoder.encode(secret));
    const kind = payload.kind;
    if (
      kind !== ROOM_TOKEN_KINDS.client &&
      kind !== ROOM_TOKEN_KINDS.server &&
      kind !== ROOM_TOKEN_KINDS.callback
    ) {
      return null;
    }
    return {
      kind,
      subject: typeof payload.sub === "string" ? payload.sub : null,
      ns: typeof payload.ns === "string" ? payload.ns : null,
      roomId: typeof payload.roomId === "string" ? payload.roomId : null,
    };
  } catch {
    return null;
  }
};

/** client トークンが対象ルームと一致するか (fail-closed) */
export const isTokenForRoom = (
  token: VerifiedRoomToken,
  ns: string,
  roomId: string,
): boolean => token.ns === ns && token.roomId === roomId;

/** Worker → Next API コールバック用の短命トークンを署名する */
export const signCallbackToken = async (
  secret: string,
  ns: string,
  roomId: string,
): Promise<string> => {
  return new SignJWT({ kind: ROOM_TOKEN_KINDS.callback, ns, roomId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("60s")
    .sign(encoder.encode(secret));
};

/** Authorization: Bearer ヘッダからトークンを取り出す */
export const extractBearerToken = (request: Request): string | null => {
  const header = request.headers.get("Authorization");
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
};
