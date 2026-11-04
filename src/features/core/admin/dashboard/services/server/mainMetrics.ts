// src/features/core/admin/dashboard/services/server/mainMetrics.ts
// 「サービスの稼働状況」セクション(MainMetricsSection)のデータ。sectionLoads.ts の main-metrics の load

import "server-only";

import { APP_FEATURES } from "@/config/app/app-features.config";
import { userService } from "@/features/user/services/server/userService";
import type { UserRoleType } from "@/features/user/types";
import { dayRangeInTimeZone } from "@/utils/date";

const ROLE_USER: UserRoleType = "user";

export type MainMetricsData = {
  totalUserCount: number;
  todayUserCount: number;
};

/**
 * ユーザー登録総数 / 本日(日本時間の日)のユーザー登録数を並列取得する。
 * 機能フラグ `APP_FEATURES.adminConsole.dashboard.showMainMetrics` が無効なら取得せず null(セクションは何も描かない)
 */
export async function loadMainMetrics(): Promise<MainMetricsData | null> {
  if (!APP_FEATURES.adminConsole.dashboard.showMainMetrics) {
    return null;
  }

  // 「本日」= 業務の時間帯(日本時間)の 0 時から翌日の 0 時。サーバーの時間帯(Vercel は UTC)では切らない
  const { start: startOfToday, end: startOfTomorrow } = dayRangeInTimeZone(new Date());

  const [{ total: totalUserCount }, { total: todayUserCount }] = await Promise.all([
    userService.search({
      limit: 1,
      where: { field: "role", op: "eq", value: ROLE_USER },
    }),
    userService.search({
      limit: 1,
      where: {
        and: [
          { field: "role", op: "eq", value: ROLE_USER },
          { field: "createdAt", op: "gte", value: startOfToday },
          { field: "createdAt", op: "lt", value: startOfTomorrow },
        ],
      },
    }),
  ]);

  return { totalUserCount, todayUserCount };
}
