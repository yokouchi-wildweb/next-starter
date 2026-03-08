export const dynamic = "force-dynamic";


import AdminNotificationTemplateCreate from "@/features/core/notificationTemplate/components/AdminNotificationTemplateCreate";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

export const metadata = {
  title: "お知らせテンプレート追加",
};

export default function AdminNotificationTemplateCreatePage() {

  return (

    <AdminPage>
      <PageTitle>お知らせテンプレート追加</PageTitle>
      <AdminNotificationTemplateCreate redirectPath="/admin/notification-templates" />
    </AdminPage>

  );
}
