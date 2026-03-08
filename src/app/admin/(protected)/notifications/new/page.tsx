export const dynamic = "force-dynamic";

import { SWRConfig } from "swr";
import { notificationTemplateService } from "@/features/notificationTemplate/services/server/notificationTemplateService";
import AdminNotificationCreate from "@/features/notification/components/AdminNotificationCreate";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

export const metadata = {
  title: "お知らせ追加",
};

export default async function AdminNotificationCreatePage() {
  const [notificationTemplates ] = await Promise.all([
    notificationTemplateService.list()
  ]);

  return (
  <SWRConfig
    value={{
      fallback: { notificationTemplates },
  }}
  >

    <AdminPage>
      <PageTitle>お知らせ追加</PageTitle>
      <AdminNotificationCreate redirectPath="/admin/notifications" />
    </AdminPage>
  </SWRConfig>
  );
}
