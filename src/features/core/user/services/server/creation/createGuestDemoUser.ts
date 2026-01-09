// src/features/core/user/services/server/creation/createGuestDemoUser.ts

import { v4 as uuidv4 } from "uuid";

import type { User } from "@/features/core/user/entities";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { GeneralUserSchema } from "@/features/core/user/entities/schema";
import { db } from "@/lib/drizzle";

const DEMO_USER_PROVIDER_TYPE = "custom";

/**
 * ゲストデモユーザーを作成する。
 * - providerType: "custom"
 * - email: null（匿名）
 * - isDemo: true
 */
export async function createGuestDemoUser(): Promise<User> {
  const providerUid = `demo-user-${uuidv4()}`;

  const values = await GeneralUserSchema.parseAsync({
    role: "user",
    status: "active",
    providerType: DEMO_USER_PROVIDER_TYPE,
    providerUid,
    isDemo: true,
    email: null,
    localPassword: null,
    displayName: "デモユーザー",
  });

  const [user] = await db.insert(UserTable).values(values).returning();

  return user;
}
