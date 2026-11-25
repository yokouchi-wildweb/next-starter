// src/app/admin/(protected)/messaging/overrides/_screen/AdminMessagingOverrideListScreen.tsx
// /admin/messaging/overrides の既定画面(page 層の本体。文言を直せる連絡の一覧)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import AdminPage from "@/app/admin/_layout/AdminPage";
import { Section } from "@/components/Layout/Section";
import { AdminMessagingSectionTabs } from "@/domains/core/messaging/components/AdminMessagingSectionTabs";
import { AdminMessageOverrideList } from "@/domains/core/messaging/components/AdminMessageOverrideList";
import { createScreen } from "@/wiring/screen";

import { loadAdminMessagingOverrideListScreen } from "./loader";

export const { Screen: AdminMessagingOverrideListScreen, generateMetadata } = createScreen({
  load: loadAdminMessagingOverrideListScreen,
  render: () => (
    <AdminPage title="システム通知" center={<AdminMessagingSectionTabs variant="header" />}>
      <Section>
        <AdminMessageOverrideList />
      </Section>
    </AdminPage>
  ),
  metadata: {
    title: "システム通知",
  },
});
