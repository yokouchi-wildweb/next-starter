// src/features/core/user/services/server/wrappers/create.ts
import type { User } from "@/features/core/user/entities";
import { createAdmin, createGeneralUser } from "../creation/console";
import type { CreateUserInput } from "@/features/core/user/services/types";
import { hasRoleProfile, type UserRoleType } from "@/features/core/user/constants";
import { userProfileService } from "@/features/core/userProfile/services/server/userProfileService";
import { syncBelongsToManyRelations } from "@/lib/crud/drizzle/belongsToMany";
import { db } from "@/lib/drizzle";
import { baseOptions } from "../drizzleBase";

export async function create(data: CreateUserInput): Promise<User> {
  const { profileData, user_tag_ids, ...userData } = data;

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

  // ユーザータグの同期
  if (user_tag_ids !== undefined) {
    const relationValues = new Map<string, unknown[]>();
    relationValues.set("user_tag_ids", user_tag_ids);
    await syncBelongsToManyRelations(
      db,
      baseOptions.belongsToManyRelations,
      user.id,
      relationValues,
    );
    user.user_tag_ids = user_tag_ids;
  }

  return user;
}
