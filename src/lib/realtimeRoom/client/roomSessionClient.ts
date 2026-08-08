// src/lib/realtimeRoom/client/roomSessionClient.ts
//
// ルーム接続セッション (WebSocket 接続トークン + 接続先 URL) を取得する ClientService。
// HTTP は ClientService に集約する (Hook から axios 直叩き禁止)。

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";

export type RoomSession = {
  token: string;
  wsUrl: string;
  protocolVersion: number;
};

export const roomSessionClient = {
  /** 対象ルームへの WebSocket 接続情報を取得する (要ログイン)。無効時は 503 */
  getSession: async (namespace: string, roomId: string): Promise<RoomSession> => {
    try {
      const { data } = await axios.get<RoomSession>("/api/realtime-room/token", {
        params: { namespace, roomId },
      });
      return data;
    } catch (error) {
      throw normalizeHttpError(error, "ルームへの接続情報の取得に失敗しました");
    }
  },
};
