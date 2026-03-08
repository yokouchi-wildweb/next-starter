import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import AdminNotificationSend from "@/features/notification/components/AdminNotificationSend";

export const metadata = {
  title: "お知らせ送信",
};

export default function AdminNotificationSendPage() {
  return (
    <AdminPage>
      <PageTitle>お知らせ送信</PageTitle>
      <AdminNotificationSend />
    </AdminPage>
  );
}
