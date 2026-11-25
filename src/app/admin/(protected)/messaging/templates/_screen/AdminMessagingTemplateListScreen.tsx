// src/app/admin/(protected)/messaging/templates/_screen/AdminMessagingTemplateListScreen.tsx
// /admin/messaging/templates の既定画面(page 層の本体。保存されたテンプレートの一覧。作る・直すは一覧のモーダル)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import AdminPage from "@/app/admin/_layout/AdminPage";
import { Section } from "@/components/Layout/Section";
import { AdminMessagingSectionTabs } from "@/domains/core/messaging/components/AdminMessagingSectionTabs";
import { AdminMessageTemplateList } from "@/domains/core/messaging/components/AdminMessageTemplateList";
import { createScreen } from "@/wiring/screen";

import { loadAdminMessagingTemplateListScreen } from "./loader";

export const { Screen: AdminMessagingTemplateListScreen, generateMetadata } = createScreen({
  load: loadAdminMessagingTemplateListScreen,
  render: () => (
    <AdminPage title="テンプレート" center={<AdminMessagingSectionTabs variant="header" />}>
      <Section>
        <AdminMessageTemplateList />
      </Section>
    </AdminPage>
  ),
  metadata: {
    title: "テンプレート",
  },
});
