// src/app/admin/(protected)/messaging/_screen/AdminMessagingDispatchListScreen.tsx
// /admin/messaging の既定画面(page 層の本体。送った回の一覧)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import AdminPage from "@/app/admin/_layout/AdminPage";
import { Section } from "@/components/Layout/Section";
import type { ScreenProps } from "@/lib/screens/types";
import { AdminDispatchList } from "@/features/core/messaging/components/AdminDispatchList";

import { loadAdminMessagingDispatchListScreen } from "./loader";

export const metadata = {
  title: "送信の履歴",
};

export async function AdminMessagingDispatchListScreen(props: ScreenProps) {
  await loadAdminMessagingDispatchListScreen(props);

  return (
    <AdminPage title="送信の履歴">
      <Section>
        <AdminDispatchList />
      </Section>
    </AdminPage>
  );
}
