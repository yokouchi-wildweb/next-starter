// src/app/admin/(protected)/chat-rooms/new/_screen/AdminChatRoomCreateScreen.tsx
// /admin/chat-rooms/new の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// dc:generate の管理画面と同じ形(共有 loader を呼ぶ)。core ドメインは dc:generate の対象外なので手で保守する。
// フォームに出る関連が無いので関連選択肢の先読み(loadAdminRelationOptions)は無い。

import AdminChatRoomCreate from "@/features/core/chatRoom/components/AdminChatRoomCreate";
import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";

export const metadata = {
  title: "チャットルーム追加",
};

export function AdminChatRoomCreateScreen() {
  return (
    <AdminPage>
      <PageTitle placement="header">チャットルーム追加</PageTitle>
      <AdminChatRoomCreate redirectPath="/admin/chat-rooms" />
    </AdminPage>
  );
}
