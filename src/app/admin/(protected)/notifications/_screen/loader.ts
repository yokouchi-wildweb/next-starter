// src/app/admin/(protected)/notifications/_screen/loader.ts
// /admin/notifications の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: ?page= / ?searchQuery= を解釈し、管理者が送ったお知らせ(sender_type = 'admin'。システム通知は除く)を
// 設定の 1 ページ件数で検索する。表示中のお知らせの既読数もまとめて取得する。
// 認可は範囲 admin/(protected)/guard.ts の createLoader(access 管理者カテゴリ)。取得の前に評価する。

import "server-only";
import { sql } from "drizzle-orm";

import type { ListPageSearchParams } from "@/lib/crud";
import type { ScreenProps } from "@/lib/screens/types";
import type { Notification } from "@/features/core/notification/entities";
import { NotificationTable } from "@/features/core/notification/entities/drizzle";
import { notificationService } from "@/features/core/notification/services/server/notificationService";
import { settingService } from "@/features/core/setting/services/server/settingService";
import { createLoader } from "@/app/admin/(protected)/guard";

export type AdminNotificationListScreenData = {
  notifications: Notification[];
  /** お知らせ ID → 既読数 */
  readCounts: Record<string, number>;
  /** 1 始まりの現在ページ */
  page: number;
  /** 1 ページの件数(設定 adminListPerPage) */
  perPage: number;
  total: number;
};

export const loadAdminNotificationListScreen = createLoader({
  access: { roleCategories: ["admin"] },
  key: async (props: ScreenProps<Record<string, never>, ListPageSearchParams>): Promise<[number, string | undefined]> => {
    const { page, searchQuery } = await props.searchParams;
    return [Number(page ?? "1"), searchQuery];
  },
  load: async (_ctx, page, searchQuery): Promise<AdminNotificationListScreenData> => {
    const perPage = await settingService.getAdminListPerPage();
    const { results: notifications, total } = await notificationService.search({
      page,
      limit: perPage,
      searchQuery,
      extraWhere: sql`${NotificationTable.sender_type} = 'admin'`,
    });
    const readCounts = await notificationService.getReadCounts(notifications.map((n) => n.id));
    return { notifications, readCounts, page, perPage, total };
  },
});
