// src/features/chatRoom/entities/model.ts

export type ChatRoom = {
  id: string;
  type: string;
  name: string | null;
  participants: string[] | null;
  participant_pair: string | null;
  read_at: any | null;
  last_message_snapshot: any | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};
