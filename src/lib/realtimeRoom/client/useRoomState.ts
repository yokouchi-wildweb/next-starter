"use client";

// src/lib/realtimeRoom/client/useRoomState.ts
//
// ルーム状態のリアルタイム購読フック。
// WebSocket を直接張る (axios は WebSocket を扱えないため、SSE ストリーミングと同種の公認例外。
// HTTP 呼び出し (トークン取得) は roomSessionClient に集約している)。
//
// 挙動:
//   - 接続直後にサーバーから現在状態が届く (購読 = 常に最新状態)
//   - 切断時は自動再接続 (トークン再取得込み、指数バックオフ)
//   - 接続トークンの期限で Worker が閉じたとき (ROOM_CLOSE_CODES.tokenExpired) は待たずに新しいトークンで再接続する
//   - config 無効時は status:"disabled" で一切通信しない (fail-closed)
//   - プロトコル不一致は status:"error" + エラーメッセージで明示

import { useCallback, useEffect, useRef, useState } from "react";

import { realtimeRoomConfig } from "../config";
import { ROOM_CLOSE_CODES, ROOM_PROTOCOL_VERSION } from "../node";
import type { RoomActionBase, RoomServerMessage, RoomStateBase } from "../node";

import { roomSessionClient } from "./roomSessionClient";

export type RoomConnectionStatus = "disabled" | "idle" | "connecting" | "connected" | "error";

export type UseRoomStateOptions = {
  /** 一過性イベント (effects の event) の受信ハンドラ (ライブフィード等) */
  onEvent?: (event: string, payload: unknown) => void;
  /** false で購読を停止する (既定 true)。モーダルを閉じた時などに */
  active?: boolean;
};

export type UseRoomStateResult<S extends RoomStateBase, A extends RoomActionBase> = {
  state: S | null;
  stateVersion: number;
  status: RoomConnectionStatus;
  error: string | null;
  /**
   * ブラウザからの直接 dispatch (RoomDefinition.clientActions 許可リストのみ)。
   * 権威性の必要なアクションはこの経路ではなく ServerService (createRoomClient) を使うこと
   */
  dispatch: (action: A) => void;
};

export const useRoomState = <
  S extends RoomStateBase = RoomStateBase,
  A extends RoomActionBase = RoomActionBase,
>(
  namespace: string,
  roomId: string | null,
  options?: UseRoomStateOptions,
): UseRoomStateResult<S, A> => {
  const enabled = realtimeRoomConfig.enabled;
  const active = options?.active ?? true;

  const [state, setState] = useState<S | null>(null);
  const [stateVersion, setStateVersion] = useState(0);
  // 接続ライフサイクル中のみ更新される内部ステータス。公開 status は導出する
  // (disabled / idle は接続前提条件から決まるため state に持たない)
  const [connStatus, setConnStatus] = useState<Exclude<RoomConnectionStatus, "disabled" | "idle">>("connecting");
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const onEventRef = useRef(options?.onEvent);
  useEffect(() => {
    onEventRef.current = options?.onEvent;
  }, [options?.onEvent]);

  useEffect(() => {
    if (!enabled || !active || !roomId) {
      return;
    }

    // この effect の回の印(D153): 片付けの後(unmount・deps の替わり)に接続の途中が終わっても開かない・開いた物は閉じる。
    // 前の回の接続の途中が次の回と二重に開かないよう、印は回ごとに持つ(共有の ref にしない)
    let disposed = false;
    let stopped = false; // 再接続しても直らない(protocol_mismatch)
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      if (disposed) return;
      setConnStatus("connecting");
      let session;
      try {
        session = await roomSessionClient.getSession(namespace, roomId);
      } catch (err) {
        if (disposed) return;
        // 503 = サーバー側で無効化されている (config/env 不一致)。再試行しない
        const message = err instanceof Error ? err.message : "接続情報の取得に失敗しました";
        setConnStatus("error");
        setError(message);
        return;
      }
      if (disposed) return;

      if (session.protocolVersion !== ROOM_PROTOCOL_VERSION) {
        setConnStatus("error");
        setError(
          `ルームサーバーのプロトコルが不一致です (app: v${ROOM_PROTOCOL_VERSION} / server: v${session.protocolVersion})`,
        );
        return;
      }

      const socket = new WebSocket(`${session.wsUrl}?token=${encodeURIComponent(session.token)}`);
      ws = socket;
      wsRef.current = socket;

      socket.onopen = () => {
        retryCountRef.current = 0;
        setConnStatus("connected");
        setError(null);
      };

      socket.onmessage = (event) => {
        let message: RoomServerMessage<S>;
        try {
          message = JSON.parse(event.data as string);
        } catch {
          return;
        }
        if (message.type === "state") {
          setState(message.state);
          setStateVersion(message.stateVersion);
        } else if (message.type === "event") {
          onEventRef.current?.(message.event, message.payload);
        } else if (message.type === "error") {
          if (message.code === "protocol_mismatch") {
            stopped = true; // 再接続しても直らないため停止
            setConnStatus("error");
          }
          setError(message.message);
        }
      };

      socket.onclose = (event) => {
        if (wsRef.current === socket) wsRef.current = null;
        if (ws === socket) ws = null;
        if (disposed || stopped) return;
        setConnStatus("connecting");
        // トークンの期限 = 通常の寿命。障害ではないので待たずに取り直す (バックオフも戻す)
        if (event.code === ROOM_CLOSE_CODES.tokenExpired) {
          retryCountRef.current = 0;
          reconnectTimer = setTimeout(connect, 0);
          return;
        }
        // 指数バックオフで再接続 (トークンは短命のため毎回取り直す)
        const delay = Math.min(
          realtimeRoomConfig.reconnectBaseDelayMs * 2 ** retryCountRef.current,
          realtimeRoomConfig.reconnectMaxDelayMs,
        );
        retryCountRef.current += 1;
        reconnectTimer = setTimeout(connect, delay);
      };

      socket.onerror = () => {
        // onclose が続いて発火し再接続に入るため、ここでは何もしない
      };
    };

    void connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      // この回の接続だけを閉じる(次の回の接続を閉じない)
      if (ws) {
        if (wsRef.current === ws) wsRef.current = null;
        ws.close();
        ws = null;
      }
    };
  }, [enabled, active, namespace, roomId]);

  const dispatch = useCallback((action: A) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ v: ROOM_PROTOCOL_VERSION, type: "dispatch", action }));
  }, []);

  // disabled (基盤無効) / idle (購読停止中・roomId 未確定) は前提条件から導出する
  const status: RoomConnectionStatus = !enabled ? "disabled" : !active || !roomId ? "idle" : connStatus;

  return { state, stateVersion, status, error, dispatch };
};
