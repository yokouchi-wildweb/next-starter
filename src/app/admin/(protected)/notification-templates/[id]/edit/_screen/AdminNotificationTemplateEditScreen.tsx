// src/app/admin/(protected)/notification-templates/[id]/edit/_screen/AdminNotificationTemplateEditScreen.tsx
// /admin/notification-templates/[id]/edit の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// dc:generate の管理画面と同じ形(_screen/loader.ts が管理画面の共通部品の組を使う)。core ドメインは dc:generate の対象外なので手で保守する。
// レコードが無ければ 404、保存後の戻り先は ?returnTo=(無ければ一覧)。どちらも loader が判定する。

import type { ScreenProps } from "@/lib/screens/types";
import type { AdminEditScreenParams, AdminEditScreenSearchParams } from "@/features/core/admin/services/server/screenData/adminEdit";
import { loadAdminNotificationTemplateEditScreen } from "./loader";
import AdminNotificationTemplateEdit from "@/features/core/notificationTemplate/components/AdminNotificationTemplateEdit";
import AdminPage from "@/app/admin/_layout/AdminPage";
import PageTitle from "@/app/admin/_layout/PageTitle";

export const metadata = {
  title: "お知らせテンプレート編集",
};

export async function AdminNotificationTemplateEditScreen(props: ScreenProps<AdminEditScreenParams, AdminEditScreenSearchParams>) {
  const { record: notificationTemplate, redirectPath } = await loadAdminNotificationTemplateEditScreen(props);

  return (
    <AdminPage>
      <PageTitle placement="header">お知らせテンプレート編集</PageTitle>
      <AdminNotificationTemplateEdit notificationTemplate={notificationTemplate} redirectPath={redirectPath} />
    </AdminPage>
  );
}
