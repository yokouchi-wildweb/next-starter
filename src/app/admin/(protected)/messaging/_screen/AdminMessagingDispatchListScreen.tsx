// src/app/admin/(protected)/messaging/_screen/AdminMessagingDispatchListScreen.tsx
// /admin/messaging の既定画面(page 層の本体。送信の一覧)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import AdminPage from "@/app/admin/_layout/AdminPage";
import { Section } from "@/components/Layout/Section";
import { AdminMessagingSectionTabs } from "@/domains/core/messaging/components/AdminMessagingSectionTabs";
import { AdminDispatchList } from "@/domains/core/messaging/components/AdminDispatchList";
import { createScreen } from "@/wiring/screen";

import { loadAdminMessagingDispatchListScreen } from "./loader";

export const { Screen: AdminMessagingDispatchListScreen, generateMetadata } = createScreen({
  load: loadAdminMessagingDispatchListScreen,
  render: () => (
    // 手動送信 / 自動送信の切り替えと「新規送信」(上の行の右端)は AdminDispatchList が出す
    <AdminPage title="メッセージ管理" center={<AdminMessagingSectionTabs variant="header" />}>
      <Section>
        <AdminDispatchList />
      </Section>
    </AdminPage>
  ),
  metadata: {
    title: "メッセージ管理",
  },
});
