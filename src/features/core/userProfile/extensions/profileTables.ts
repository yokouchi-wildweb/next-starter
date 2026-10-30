// 生成物・編集不可: pnpm role:generate が src/features/core/userProfile/extensionPoints.ts から生成する
// src/features/core/userProfile/extensions/profileTables.ts

import type { PgTable } from "drizzle-orm/pg-core";

import { ContributorProfileTable } from "@/features/core/userProfile/entities/profiles/contributor/drizzle";

export const profileTables: Record<string, PgTable & Record<string, any>> = {
  contributor: ContributorProfileTable,
};
