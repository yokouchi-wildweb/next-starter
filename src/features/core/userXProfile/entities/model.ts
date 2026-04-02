// src/features/userXProfile/entities/model.ts

export type UserXProfile = {
  id: string;
  userId: string;
  xUserId: string;
  username: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
  tokenExpiresAt: Date;
  scopes: string[] | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};
