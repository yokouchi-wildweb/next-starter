// src/app/admin/(protected)/chat-rooms/[id]/edit/_screen/AdminChatRoomEditScreen.tsx
// /admin/chat-rooms/[id]/edit の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// dc:generate の管理画面と同じ形(共有 loader を呼ぶ)。core ドメインは dc:generate の対象外なので手で保守する。
// レコードが無ければ 404、保存後の戻り先は ?returnTo=(無ければ一覧)。どちらも共有 loader が判定する。

import type { ScreenProps } from "@/lib/screens/types";
import {
  loadAdminEditScreen,
  type AdminEditScreenParams,
  type AdminEditScreenSearchParams,
} from "@/features/core/admin/services/server/loaders/adminEdit";
import { chatRoomService } from "@/features/core/chatRoom/services/server/chatRoomService";
import AdminChatRoomEdit from "@/features/core/chatRoom/components/AdminChatRoomEdit";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

export const metadata = {
  title: "チャットルーム編集",
};

export async function AdminChatRoomEditScreen(props: ScreenProps<AdminEditScreenParams, AdminEditScreenSearchParams>) {
  const { record: chatRoom, redirectPath } = await loadAdminEditScreen(chatRoomService, props, "/admin/chat-rooms");

  return (
    <AdminPage>
      <PageTitle placement="header">チャットルーム編集</PageTitle>
      <AdminChatRoomEdit chatRoom={chatRoom} redirectPath={redirectPath} />
    </AdminPage>
  );
}
