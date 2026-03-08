export const dynamic = "force-dynamic";


import { notificationTemplateService } from "@/features/core/notificationTemplate/services/server/notificationTemplateService";
import AdminNotificationTemplateEdit from "@/features/core/notificationTemplate/components/AdminNotificationTemplateEdit";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import type { NotificationTemplate } from "@/features/core/notificationTemplate/entities";
import { resolveReturnTo } from "@/lib/crud/utils";

export const metadata = {
  title: "お知らせテンプレート編集",
};

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
};

export default async function AdminNotificationTemplateEditPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { returnTo } = await searchParams;
  const redirectPath = resolveReturnTo(returnTo, "/admin/notification-templates");

  const notificationTemplate = (await notificationTemplateService.get(id)) as NotificationTemplate;


  return (

    <AdminPage>
      <PageTitle>お知らせテンプレート編集</PageTitle>
      <AdminNotificationTemplateEdit notificationTemplate={notificationTemplate as NotificationTemplate} redirectPath={redirectPath} />
    </AdminPage>

  );
}
