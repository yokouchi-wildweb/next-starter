export const dynamic = "force-dynamic";

import { sql } from "drizzle-orm";
import { notificationService } from "@/features/notification/services/server/notificationService";
import { NotificationTable } from "@/features/notification/entities/drizzle";
import { settingService } from "@/features/setting/services/server/settingService";
import type { ListPageSearchParams } from "@/lib/crud";
import AdminNotificationList from "@/features/notification/components/AdminNotificationList";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

export const metadata = {
  title: "お知らせ一覧",
};

type Props = {
  searchParams: Promise<ListPageSearchParams>;
};

export default async function AdminNotificationListPage({ searchParams }: Props) {
  const { page: pageStr, searchQuery } = await searchParams;
  const page = Number(pageStr ?? "1");
  const limit = await settingService.getAdminListPerPage();

  // 管理者が送信したお知らせを表示（全員・ロール指定・個別送信すべて）
  const extraWhere = sql`${NotificationTable.sender_type} = 'admin'`;

  const { results: notifications, total } = await notificationService.search({
    page,
    limit,
    searchQuery,
    extraWhere,
  });

  // 表示中の通知に対する既読数を取得
  const readCounts = await notificationService.getReadCounts(
    notifications.map((n) => n.id)
  );

  return (
    <AdminPage>
      <PageTitle>お知らせ管理</PageTitle>
      <AdminNotificationList notifications={notifications} readCounts={readCounts} page={page} perPage={limit} total={total} />
    </AdminPage>
  );
}
