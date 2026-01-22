// scripts/db/seed/data/demoUser.ts

import { db } from "@/lib/drizzle";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { eq, and } from "drizzle-orm";

const DEMO_USER_PROVIDER_TYPE = "custom" as const;
const DEMO_USER_PROVIDER_UID = "demo-user-u001";

export async function seedDemoUser() {
  console.log("  → デモユーザーを作成中...");

  // 既存のデモユーザーを確認
  const existing = await db
    .select()
    .from(UserTable)
    .where(
      and(
        eq(UserTable.providerType, DEMO_USER_PROVIDER_TYPE),
        eq(UserTable.providerUid, DEMO_USER_PROVIDER_UID)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    console.log("  ✓ デモユーザーは既に存在します (スキップ)");
    return existing[0];
  }

  // デモユーザーを作成
  const [demoUser] = await db
    .insert(UserTable)
    .values({
      providerType: DEMO_USER_PROVIDER_TYPE,
      providerUid: DEMO_USER_PROVIDER_UID,
      email: "demo@example.com",
      name: "デモユーザー",
      role: "user",
      status: "active",
      isDemo: true,
    })
    .returning();

  console.log("  ✓ デモユーザーを作成しました");
  return demoUser;
}
