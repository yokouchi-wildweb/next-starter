// src/features/chatRoom/stores/messageSending/internalStore.ts
"use client";

import { create } from "zustand";

import type { MessageSendingStatus, PendingMessage } from "./types";

type MessageSendingState = {
  /** roomId → PendingMessage[] のマップ */
  pendingByRoom: Record<string, PendingMessage[]>;

  /** 送信中メッセージを追加する */
  addPending: (message: PendingMessage) => void;

  /** メッセージの送信状態を更新する */
  updateStatus: (id: string, status: MessageSendingStatus) => void;

  /** 送信中メッセージを除去する（実メッセージ到着時） */
  removePending: (id: string) => void;

  /** 指定ルームの送信済み（"sent"）メッセージをすべて除去する */
  clearSent: (roomId: string) => void;

  /** 指定ルームの全 pending メッセージを除去する */
  clearRoom: (roomId: string) => void;
};

export const internalStore = create<MessageSendingState>((set) => ({
  pendingByRoom: {},

  addPending: (message) =>
    set((state) => {
      const roomMessages = state.pendingByRoom[message.roomId] ?? [];
      return {
        pendingByRoom: {
          ...state.pendingByRoom,
          [message.roomId]: [...roomMessages, message],
        },
      };
    }),

  updateStatus: (id, status) =>
    set((state) => {
      const updated: Record<string, PendingMessage[]> = {};
      for (const [roomId, messages] of Object.entries(state.pendingByRoom)) {
        updated[roomId] = messages.map((m) =>
          m.id === id ? { ...m, status } : m,
        );
      }
      return { pendingByRoom: updated };
    }),

  removePending: (id) =>
    set((state) => {
      const updated: Record<string, PendingMessage[]> = {};
      for (const [roomId, messages] of Object.entries(state.pendingByRoom)) {
        const filtered = messages.filter((m) => m.id !== id);
        if (filtered.length > 0) {
          updated[roomId] = filtered;
        }
      }
      return { pendingByRoom: updated };
    }),

  clearSent: (roomId) =>
    set((state) => {
      const messages = state.pendingByRoom[roomId];
      if (!messages) return state;
      const remaining = messages.filter((m) => m.status !== "sent");
      if (remaining.length === 0) {
        const { [roomId]: _, ...rest } = state.pendingByRoom;
        return { pendingByRoom: rest };
      }
      return {
        pendingByRoom: { ...state.pendingByRoom, [roomId]: remaining },
      };
    }),

  clearRoom: (roomId) =>
    set((state) => {
      const { [roomId]: _, ...rest } = state.pendingByRoom;
      return { pendingByRoom: rest };
    }),
}));
