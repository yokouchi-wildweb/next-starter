// src/app/admin/(protected)/notifications/send/_screen/AdminNotificationSendScreen.tsx
// /admin/notifications/send の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// loader は無い(サーバー側の取得も遷移制御も無い。送信はセクションコンテナ AdminNotificationSend が hook で行う)。

import AdminPage from "@/app/admin/_layout/AdminPage";
import PageTitle from "@/app/admin/_layout/PageTitle";
import AdminNotificationSend from "@/features/core/notification/components/AdminNotificationSend";

export const metadata = {
  title: "お知らせ送信",
};

export function AdminNotificationSendScreen() {
  return (
    <AdminPage>
      <PageTitle placement="header">お知らせ送信</PageTitle>
      <AdminNotificationSend />
    </AdminPage>
  );
}
