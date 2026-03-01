// src/features/core/analytics/services/server/dauService.ts
// DAU記録サービス — UPSERT (ON CONFLICT DO NOTHING) で1日1ユーザー1レコードを保証

import { db } from "@/lib/drizzle";
import { UserDailyActivityTable } from "@/features/core/analytics/entities/drizzle";
import { DEFAULT_TIMEZONE } from "@/features/core/analytics/constants";
import { formatDateKeyTz } from "./utils/dateRange";

/**
 * ユーザーの日次アクティビティを記録する
 * UPSERT (ON CONFLICT DO NOTHING) により冪等。同日の重複呼び出しは無害。
 */
export async function recordDailyActivity(userId: string): Promise<void> {
  const today = formatDateKeyTz(new Date(), DEFAULT_TIMEZONE);

  await db
    .insert(UserDailyActivityTable)
    .values({
      userId,
      activityDate: today,
    })
    .onConflictDoNothing({
      target: [UserDailyActivityTable.userId, UserDailyActivityTable.activityDate],
    });
}
