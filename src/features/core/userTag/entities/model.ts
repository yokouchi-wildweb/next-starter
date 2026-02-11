// src/features/userTag/entities/model.ts

export type UserTag = {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};
