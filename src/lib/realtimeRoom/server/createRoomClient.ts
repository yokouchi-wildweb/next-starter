// src/lib/realtimeRoom/server/createRoomClient.ts
//
// Next サーバー (ServerService) からルームサーバーを呼ぶクライアント。
// 経済・権威性の絡むアクションは必ずこの経路で dispatch する
// (ブラウザ直接 dispatch は RoomDefinition.clientActions の許可リスト制)。

import "server-only";

import { DomainError } from "@/lib/errors";
import { ROOM_PROTOCOL_VERSION } from "@/lib/realtimeRoom/protocol";
import type {
  RoomActionBase,
  RoomDispatchResponse,
  RoomStateBase,
  RoomStateResponse,
} from "@/lib/realtimeRoom/protocol";

import { getRealtimeRoomEnv } from "./env";
import { signRoomServerToken } from "./tokens";

export type RoomHandle<S extends RoomStateBase, A extends RoomActionBase> = {
  /** アクションを直列実行し、適用後の状態を返す */
  dispatch: (action: A, options?: { userId?: string }) => Promise<RoomDispatchResponse<S>>;
  /** 現在状態を取得する */
  getState: () => Promise<RoomStateResponse<S>>;
};

export type RoomClient<S extends RoomStateBase, A extends RoomActionBase> = {
  room: (roomId: string) => RoomHandle<S, A>;
};

const requestRoom = async <T>(path: string, init: RequestInit): Promise<T> => {
  const { baseUrl } = getRealtimeRoomEnv();
  const token = await signRoomServerToken();

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
  } catch {
    throw new DomainError("ルームサーバーに接続できません", { status: 502 });
  }

  if (!response.ok) {
    throw new DomainError(`ルームサーバーがエラーを返しました (${response.status})`, { status: 502 });
  }

  const body = (await response.json()) as T & { v?: number };
  if (body.v !== ROOM_PROTOCOL_VERSION) {
    // スキュー検知: 古い Worker が動き続けている場合に明示エラーで気づけるようにする
    throw new DomainError(
      `ルームサーバーのプロトコルが不一致です (app: v${ROOM_PROTOCOL_VERSION} / server: v${body.v})。servers/room を再デプロイしてください`,
      { status: 502 },
    );
  }
  return body;
};

/**
 * namespace 単位のルームクライアントを生成する。
 *
 * @example
 * const raid = createRoomClient<RaidState, RaidAction>("raid");
 * const result = await raid.room(machineId).dispatch({ type: "attack", payload: { damage } }, { userId });
 */
export const createRoomClient = <
  S extends RoomStateBase = RoomStateBase,
  A extends RoomActionBase = RoomActionBase,
>(
  namespace: string,
): RoomClient<S, A> => ({
  room: (roomId: string) => {
    const base = `/rooms/${encodeURIComponent(namespace)}/${encodeURIComponent(roomId)}`;
    return {
      dispatch: (action, options) =>
        requestRoom<RoomDispatchResponse<S>>(`${base}/dispatch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, userId: options?.userId ?? null }),
        }),
      getState: () => requestRoom<RoomStateResponse<S>>(`${base}/state`, { method: "GET" }),
    };
  },
});
