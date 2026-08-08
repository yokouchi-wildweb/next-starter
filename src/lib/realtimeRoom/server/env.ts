// src/lib/realtimeRoom/server/env.ts
//
// 有効/無効の判定と接続情報の取得 (判定の1点集約)。
// enabled フラグ (config) + env の両方が揃って初めて有効。揃っていなければ fail-closed。

import "server-only";

import { REALTIME_ROOM_CONFIG } from "@/config/app/realtime-room.config";
import { DomainError } from "@/lib/errors";

export type RealtimeRoomEnv = {
  /** ルームサーバーのベース URL (例: https://room-server.example.workers.dev) */
  baseUrl: string;
  /** HS256 共有署名鍵 */
  secret: string;
};

/** 有効化されているか (config + env の両方が揃っているか) */
export const isRealtimeRoomEnabled = (): boolean => {
  if (!REALTIME_ROOM_CONFIG.enabled) return false;
  const url = process.env.REALTIME_ROOM_URL;
  const secret = process.env.REALTIME_ROOM_AUTH_SECRET;
  return Boolean(url && url.trim().length > 0 && secret && secret.trim().length > 0);
};

/**
 * 接続情報を取得する。無効時は DomainError(503) (fail-closed、dbAgent と同方式)。
 */
export const getRealtimeRoomEnv = (): RealtimeRoomEnv => {
  if (!REALTIME_ROOM_CONFIG.enabled) {
    throw new DomainError("リアルタイムルーム基盤は無効です (realtime-room.config)", { status: 503 });
  }
  const baseUrl = process.env.REALTIME_ROOM_URL?.trim();
  const secret = process.env.REALTIME_ROOM_AUTH_SECRET?.trim();
  if (!baseUrl || !secret) {
    throw new DomainError(
      "リアルタイムルーム基盤の環境変数が未設定です (REALTIME_ROOM_URL / REALTIME_ROOM_AUTH_SECRET)",
      { status: 503 },
    );
  }
  return { baseUrl: baseUrl.replace(/\/$/, ""), secret };
};

/** WebSocket 接続 URL を導出する (https → wss) */
export const toWebSocketUrl = (baseUrl: string, ns: string, roomId: string): string => {
  const wsBase = baseUrl.replace(/^http/, "ws");
  return `${wsBase}/rooms/${encodeURIComponent(ns)}/${encodeURIComponent(roomId)}/ws`;
};
