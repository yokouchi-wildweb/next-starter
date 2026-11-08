// src/features/userLineProfile/entities/model.ts

export type UserLineProfile = {
  id: string;
  userId: string;
  lineUserId: string;
  displayName: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};
