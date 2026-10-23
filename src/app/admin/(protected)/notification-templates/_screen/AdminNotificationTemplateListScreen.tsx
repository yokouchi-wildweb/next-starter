// src/app/admin/(protected)/notification-templates/_screen/AdminNotificationTemplateListScreen.tsx
// /admin/notification-templates の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。手順: src/lib/screens/README.md
//
// dc:generate の管理画面と同じ形(共有 loader を呼ぶ)。core ドメインは dc:generate の対象外なので手で保守する。

import type { ListPageSearchParams } from "@/lib/crud";
import type { ScreenProps } from "@/lib/screens/types";
import { loadAdminListScreen } from "@/features/core/admin/services/server/loaders/adminList";
import { notificationTemplateService } from "@/features/core/notificationTemplate/services/server/notificationTemplateService";
import AdminNotificationTemplateList from "@/features/core/notificationTemplate/components/AdminNotificationTemplateList";
import AdminPage from "@/app/admin/_layout/AdminPage";
import PageTitle from "@/app/admin/_layout/PageTitle";

export const metadata = {
  title: "お知らせテンプレート一覧",
};

export async function AdminNotificationTemplateListScreen(props: ScreenProps<Record<string, never>, ListPageSearchParams>) {
  const { results: notificationTemplates, page, limit, total } = await loadAdminListScreen(notificationTemplateService, props);

  return (
    <AdminPage>
      <PageTitle placement="header">お知らせテンプレート管理</PageTitle>
      <AdminNotificationTemplateList notificationTemplates={notificationTemplates} page={page} perPage={limit} total={total} />
    </AdminPage>
  );
}
