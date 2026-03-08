export const dynamic = "force-dynamic";

import { notificationService } from "@/features/notification/services/server/notificationService";

import { settingService } from "../../../../features/core/setting/services/server/settingService";
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
  const { results: notifications, total } = await notificationService.search({ page, limit, searchQuery });

  return (
    <AdminPage>
      <PageTitle>お知らせ管理</PageTitle>
      <AdminNotificationList notifications={notifications} page={page} perPage={limit} total={total} />
    </AdminPage>
  );
}
