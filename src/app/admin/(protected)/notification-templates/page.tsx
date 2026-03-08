export const dynamic = "force-dynamic";

import { notificationTemplateService } from "@/features/core/notificationTemplate/services/server/notificationTemplateService";

import { settingService } from "../../../../features/core/setting/services/server/settingService";
import type { ListPageSearchParams } from "@/lib/crud";
import AdminNotificationTemplateList from "@/features/core/notificationTemplate/components/AdminNotificationTemplateList";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

export const metadata = {
  title: "お知らせテンプレート一覧",
};

type Props = {
  searchParams: Promise<ListPageSearchParams>;
};

export default async function AdminNotificationTemplateListPage({ searchParams }: Props) {
  const { page: pageStr, searchQuery } = await searchParams;
  const page = Number(pageStr ?? "1");
  const limit = await settingService.getAdminListPerPage();
  const { results: notificationTemplates, total } = await notificationTemplateService.search({ page, limit, searchQuery });

  return (
    <AdminPage>
      <PageTitle>お知らせテンプレート管理</PageTitle>
      <AdminNotificationTemplateList notificationTemplates={notificationTemplates} page={page} perPage={limit} total={total} />
    </AdminPage>
  );
}
