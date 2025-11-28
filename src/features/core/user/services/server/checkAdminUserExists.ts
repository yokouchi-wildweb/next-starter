// src/features/user/services/server/checkAdminUserExists.ts
import { eq } from "drizzle-orm";

import { UserTable } from "@/features/core/user/entities/drizzle";
import { db } from "@/lib/drizzle";

export async function checkAdminUserExists(): Promise<boolean> {
  const adminUser = await db.query.UserTable.findFirst({
    columns: { id: true },
    where: eq(UserTable.role, "admin"),
  });

  return Boolean(adminUser);
}
