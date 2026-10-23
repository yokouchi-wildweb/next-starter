// src/app/admin/(protected)/chat-rooms/_screen/AdminChatRoomListScreen.tsx
// /admin/chat-rooms の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// dc:generate の管理画面と同じ形(共有 loader を呼ぶ)。core ドメインは dc:generate の対象外なので手で保守する。

import type { ListPageSearchParams } from "@/lib/crud";
import type { ScreenProps } from "@/lib/screens/types";
import { loadAdminListScreen } from "@/features/core/admin/services/server/loaders/adminList";
import { chatRoomService } from "@/features/core/chatRoom/services/server/chatRoomService";
import AdminChatRoomList from "@/features/core/chatRoom/components/AdminChatRoomList";
import AdminPage from "@/app/admin/_layout/AdminPage";
import PageTitle from "@/app/admin/_layout/PageTitle";

export const metadata = {
  title: "チャットルーム一覧",
};

export async function AdminChatRoomListScreen(props: ScreenProps<Record<string, never>, ListPageSearchParams>) {
  const { results: chatRooms, page, limit, total } = await loadAdminListScreen(chatRoomService, props);

  return (
    <AdminPage>
      <PageTitle placement="header">チャットルーム管理</PageTitle>
      <AdminChatRoomList chatRooms={chatRooms} page={page} perPage={limit} total={total} />
    </AdminPage>
  );
}
