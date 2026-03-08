export const dynamic = "force-dynamic";


import { chatRoomService } from "@/features/core/chatRoom/services/server/chatRoomService";
import AdminChatRoomEdit from "@/features/core/chatRoom/components/AdminChatRoomEdit";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import type { ChatRoom } from "@/features/core/chatRoom/entities";
import { resolveReturnTo } from "@/lib/crud/utils";

export const metadata = {
  title: "チャットルーム編集",
};

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
};

export default async function AdminChatRoomEditPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { returnTo } = await searchParams;
  const redirectPath = resolveReturnTo(returnTo, "/admin/chat-rooms");

  const chatRoom = (await chatRoomService.get(id)) as ChatRoom;


  return (

    <AdminPage>
      <PageTitle>チャットルーム編集</PageTitle>
      <AdminChatRoomEdit chatRoom={chatRoom as ChatRoom} redirectPath={redirectPath} />
    </AdminPage>

  );
}
