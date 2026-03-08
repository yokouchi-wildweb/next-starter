export const dynamic = "force-dynamic";

import { SWRConfig } from "swr";
import { notificationTemplateService } from "@/features/notificationTemplate/services/server/notificationTemplateService";
import { notificationService } from "@/features/core/notification/services/server/notificationService";
import AdminNotificationEdit from "@/features/core/notification/components/AdminNotificationEdit";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import type { Notification } from "@/features/core/notification/entities";
import { resolveReturnTo } from "@/lib/crud/utils";

export const metadata = {
  title: "お知らせ編集",
};

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
};

export default async function AdminNotificationEditPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { returnTo } = await searchParams;
  const redirectPath = resolveReturnTo(returnTo, "/admin/notifications");

  const [notification, notificationTemplates ] = await Promise.all([
    notificationService.get(id),
    notificationTemplateService.list()
  ]);


  return (
  <SWRConfig
    value={{
      fallback: { notificationTemplates },
  }}
  >

    <AdminPage>
      <PageTitle>お知らせ編集</PageTitle>
      <AdminNotificationEdit notification={notification as Notification} redirectPath={redirectPath} />
    </AdminPage>
  </SWRConfig>
  );
}
