// src/app/admin/(protected)/notifications/_screen/AdminNotificationListScreen.tsx
// /admin/notifications の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import type { ListPageSearchParams } from "@/lib/crud";
import type { ScreenProps } from "@/lib/screens/types";
import AdminNotificationList from "@/features/core/notification/components/AdminNotificationList";
import AdminPage from "@/app/admin/_layout/AdminPage";
import PageTitle from "@/app/admin/_layout/PageTitle";

import { loadAdminNotificationListScreen } from "./loader";

export const metadata = {
  title: "お知らせ一覧",
};

export async function AdminNotificationListScreen(props: ScreenProps<Record<string, never>, ListPageSearchParams>) {
  const { notifications, readCounts, page, perPage, total } = await loadAdminNotificationListScreen(props);

  return (
    <AdminPage>
      <PageTitle placement="header">お知らせ管理</PageTitle>
      <AdminNotificationList
        notifications={notifications}
        readCounts={readCounts}
        page={page}
        perPage={perPage}
        total={total}
      />
    </AdminPage>
  );
}
