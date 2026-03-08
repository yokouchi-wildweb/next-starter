// src/features/chatRoom/entities/model.ts

export type ChatRoom = {
  id: string;
  type: string;
  name: string | null;
  participants: string[] | null;
  participantPair: string | null;
  readAt: any | null;
  lastMessageSnapshot: any | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};
