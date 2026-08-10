// servers/room/src/index.ts
//
// Worker エントリ。ルーティングのみを担い、実体は RoomDurableObject に転送する。
//
// ルーティング:
//   GET  /version                        — プロトコルバージョン (公開、スキュー検知用)
//   GET  /rooms/:ns/:roomId/ws           — WebSocket 購読 (room_client トークン)
//   POST /rooms/:ns/:roomId/dispatch     — サーバー dispatch (room_server トークン)
//   GET  /rooms/:ns/:roomId/state        — 状態取得 (room_server トークン)
//
// namespace はレジストリ登録済みのもののみ受け付ける (fail-closed 404)。

import { ROOM_PROTOCOL_VERSION } from "@/lib/realtimeRoom/protocol";

import { RoomDurableObject } from "./core/room";
import type { Env } from "./core/types";
import { roomRegistry } from "./registry";

export { RoomDurableObject };

const ROOM_PATH_PATTERN = /^\/rooms\/([^/]+)\/([^/]+)\/(ws|dispatch|state)$/;

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/version") {
      return new Response(JSON.stringify({ protocolVersion: ROOM_PROTOCOL_VERSION }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const match = ROOM_PATH_PATTERN.exec(url.pathname);
    if (!match) {
      return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    }

    const [, ns, roomId] = match;
    if (!roomRegistry[ns]) {
      return new Response(JSON.stringify({ error: "unknown room namespace" }), { status: 404 });
    }

    // 「1 ルーム = 1 インスタンス」: ns + roomId から決定的に同一 DO へルーティングされる
    const id = env.ROOM.idFromName(`${ns}/${roomId}`);
    const stub = env.ROOM.get(id);

    // new Request(request) は upgrade を含む全属性を保存したまま headers を可変にする
    const forwarded = new Request(request);
    forwarded.headers.set("x-room-ns", ns);
    forwarded.headers.set("x-room-id", roomId);

    return stub.fetch(forwarded);
  },
};

export default worker;
