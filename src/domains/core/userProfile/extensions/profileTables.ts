// 生成物・編集不可: pnpm generate role が src/domains/core/userProfile/extensionPoints.ts から生成する
// src/domains/core/userProfile/extensions/profileTables.ts

import type { PgTable } from "drizzle-orm/pg-core";

import { ContributorProfileTable } from "@/domains/core/userProfile/entities/profiles/contributor/drizzle";

export const profileTables: Record<string, PgTable & Record<string, any>> = {
  contributor: ContributorProfileTable,
};
