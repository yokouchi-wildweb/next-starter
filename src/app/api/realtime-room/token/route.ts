// src/app/api/realtime-room/token/route.ts
//
// ルーム接続セッション発行 API。
// ブラウザはアプリドメインの httpOnly セッションを Worker (別ドメイン) に送れないため、
// ここでログイン済みユーザーに短命の WebSocket 接続トークンを発行して橋渡しする。
// 基盤無効時は 503 (fail-closed)。

import { NextResponse, type NextRequest } from "next/server";

import { getSessionUser } from "@/features/core/auth/services/server/session/getSessionUser";
import { DomainError } from "@/lib/errors";
import { ROOM_PROTOCOL_VERSION } from "@/lib/realtimeRoom/protocol";
import { getRealtimeRoomEnv, signRoomClientToken, toWebSocketUrl } from "@/lib/realtimeRoom/server";
import { createApiRoute } from "@/lib/routeFactory";

export const GET = createApiRoute(
  {
    operation: "GET /api/realtime-room/token",
    operationType: "read",
    access: "authenticated",
  },
  async (request: NextRequest) => {
    // 認可 (ログイン必須) は factory で強制済み。userId をトークン subject に載せるために取得する
    const user = await getSessionUser();
    if (!user) {
      throw new DomainError("ログインが必要です", { status: 401 });
    }

    const url = new URL(request.url);
    const namespace = url.searchParams.get("namespace")?.trim();
    const roomId = url.searchParams.get("roomId")?.trim();
    if (!namespace || !roomId) {
      throw new DomainError("namespace と roomId は必須です", { status: 400 });
    }

    const { baseUrl } = getRealtimeRoomEnv(); // 無効時はここで 503

    const token = await signRoomClientToken({ ns: namespace, roomId, userId: user.userId });

    return NextResponse.json(
      {
        token,
        wsUrl: toWebSocketUrl(baseUrl, namespace, roomId),
        protocolVersion: ROOM_PROTOCOL_VERSION,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  },
);
