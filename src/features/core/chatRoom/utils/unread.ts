// src/features/chatRoom/utils/unread.ts
//
// 未読判定ユーティリティ。

import type { ChatRoom } from "@/features/chatRoom/entities";
import type { LastMessageSnapshot, ReadAtMap } from "@/features/chatRoom/entities/message";

/**
 * ルームが未読かどうかを判定する。
 *
 * 判定ロジック:
 * - 最新メッセージの送信者が自分なら未読としない
 * - lastMessageSnapshot.createdAt > readAt[uid] なら未読
 */
export function isRoomUnread(room: ChatRoom, uid: string): boolean {
  const snapshot = room.lastMessageSnapshot as LastMessageSnapshot | null;
  if (!snapshot?.createdAt) return false;

  // 自分が送った最新メッセージでは未読にしない
  if (snapshot.senderId === uid) return false;

  const readAt = room.readAt as ReadAtMap | null;
  const userReadAt = readAt?.[uid];
  if (!userReadAt) return true;

  return snapshot.createdAt > userReadAt;
}

/**
 * 未読ルーム数をカウントする。
 */
export function countUnreadRooms(rooms: ChatRoom[], uid: string): number {
  return rooms.filter((room) => isRoomUnread(room, uid)).length;
}
