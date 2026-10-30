// src/features/core/notification/services/server/notification/searchAdminSent.ts

import { sql } from "drizzle-orm";

import type { Notification } from "@/features/core/notification/entities";
import { NotificationTable } from "@/features/core/notification/entities/drizzle";

import { base } from "../drizzleBase";

/**
 * 管理者が送ったお知らせ(sender_type = 'admin'。システム通知は除く)を検索する(管理画面の一覧用)。
 * page / limit / searchQuery は base.search と同じ意味
 */
export async function searchAdminSent(params: {
  page: number;
  limit: number;
  searchQuery: string | undefined;
}): Promise<{ results: Notification[]; total: number }> {
  return base.search({
    ...params,
    extraWhere: sql`${NotificationTable.sender_type} = 'admin'`,
  });
}
