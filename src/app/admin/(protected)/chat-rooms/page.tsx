export const dynamic = "force-dynamic";

import { chatRoomService } from "@/features/core/chatRoom/services/server/chatRoomService";

import { settingService } from "../../../../features/core/setting/services/server/settingService";
import type { ListPageSearchParams } from "@/lib/crud";
import AdminChatRoomList from "@/features/core/chatRoom/components/AdminChatRoomList";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

export const metadata = {
  title: "チャットルーム一覧",
};

type Props = {
  searchParams: Promise<ListPageSearchParams>;
};

export default async function AdminChatRoomListPage({ searchParams }: Props) {
  const { page: pageStr, searchQuery } = await searchParams;
  const page = Number(pageStr ?? "1");
  const limit = await settingService.getAdminListPerPage();
  const { results: chatRooms, total } = await chatRoomService.search({ page, limit, searchQuery });

  return (
    <AdminPage>
      <PageTitle>チャットルーム管理</PageTitle>
      <AdminChatRoomList chatRooms={chatRooms} page={page} perPage={limit} total={total} />
    </AdminPage>
  );
}
