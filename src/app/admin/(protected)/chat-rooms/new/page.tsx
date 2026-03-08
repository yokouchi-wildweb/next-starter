export const dynamic = "force-dynamic";


import AdminChatRoomCreate from "@/features/core/chatRoom/components/AdminChatRoomCreate";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

export const metadata = {
  title: "チャットルーム追加",
};

export default function AdminChatRoomCreatePage() {

  return (

    <AdminPage>
      <PageTitle>チャットルーム追加</PageTitle>
      <AdminChatRoomCreate redirectPath="/admin/chat-rooms" />
    </AdminPage>

  );
}
