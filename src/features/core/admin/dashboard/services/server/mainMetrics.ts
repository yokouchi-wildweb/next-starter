// src/features/core/admin/dashboard/services/server/mainMetrics.ts
// 「サービスの稼働状況」セクション(MainMetricsSection)のデータ。sectionLoads.ts の main-metrics の load

import "server-only";

import dayjs from "dayjs";

import { APP_FEATURES } from "@/config/app/app-features.config";
import { userService } from "@/features/user/services/server/userService";
import type { UserRoleType } from "@/features/user/types";

const ROLE_USER: UserRoleType = "user";

export type MainMetricsData = {
  totalUserCount: number;
  todayUserCount: number;
};

/**
 * ユーザー登録総数 / 本日のユーザー登録数を並列取得する。
 * 機能フラグ `APP_FEATURES.adminConsole.dashboard.showMainMetrics` が無効なら取得せず null(セクションは何も描かない)
 */
export async function loadMainMetrics(): Promise<MainMetricsData | null> {
  if (!APP_FEATURES.adminConsole.dashboard.showMainMetrics) {
    return null;
  }

  const startOfToday = dayjs().startOf("day");
  const startOfTomorrow = startOfToday.add(1, "day");

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
          { field: "createdAt", op: "gte", value: startOfToday.toDate() },
          { field: "createdAt", op: "lt", value: startOfTomorrow.toDate() },
        ],
      },
    }),
  ]);

  return { totalUserCount, todayUserCount };
}
