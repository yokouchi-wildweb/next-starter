// src/features/core/chatRoom/services/server/isChatParticipant.ts
//
// 利用者がチャットルームの現参加者かを判定する（ファイル用途 chatRoom.* の upload / read の check）。
// 参加者は Firestore の chat_rooms.participants にあるため、Admin SDK（chatRoomService）で読む。
// 論理削除したルーム・存在しないルーム・ルーム ID 無しは false。

import { chatRoomService } from "./chatRoomService";

export async function isChatParticipant(
  roomId: string | null,
  actor: { userId: string } | null,
): Promise<boolean> {
  if (!roomId || !actor) return false;
  const room = await chatRoomService.get(roomId);
  if (!room) return false;
  return (room.participants ?? []).includes(actor.userId);
}
