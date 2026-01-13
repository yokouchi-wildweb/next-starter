// src/features/core/user/services/server/wrappers/create.ts
import type { User } from "@/features/core/user/entities";
import { createAdmin, createGeneralUser } from "../creation/console";
import type { CreateUserInput } from "@/features/core/user/services/types";
import { hasRoleProfile, type UserRoleType } from "@/features/core/user/constants";
import { userProfileService } from "@/features/core/userProfile/services/server/userProfileService";

export async function create(data: CreateUserInput): Promise<User> {
  const { profileData, ...userData } = data;

  const user =
    data.role === "admin"
      ? await createAdmin(userData)
      : await createGeneralUser(userData);

  // プロフィールデータの作成
  if (profileData && hasRoleProfile(user.role as UserRoleType)) {
    await userProfileService.upsertProfile(
      user.id,
      user.role as UserRoleType,
      profileData,
    );
  }

  return user;
}
