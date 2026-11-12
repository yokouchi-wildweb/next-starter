// src/app/admin/(protected)/messaging/templates/_screen/AdminMessagingTemplateListScreen.tsx
// /admin/messaging/templates の既定画面(page 層の本体。保存されたテンプレートの一覧)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import AdminPage from "@/app/admin/_layout/AdminPage";
import { LinkButton } from "@/components/Form/Button";
import { Section } from "@/components/Layout/Section";
import type { ScreenProps } from "@/lib/screens/types";
import { AdminMessageTemplateList } from "@/features/core/messaging/components/AdminMessageTemplateList";

import { loadAdminMessagingTemplateListScreen } from "./loader";

export const metadata = {
  title: "テンプレート",
};

export async function AdminMessagingTemplateListScreen(props: ScreenProps) {
  await loadAdminMessagingTemplateListScreen(props);

  return (
    <AdminPage
      title="テンプレート"
      actions={
        <LinkButton href="/admin/messaging/templates/new" size="sm" variant="primary">
          新しく作る
        </LinkButton>
      }
    >
      <Section>
        <AdminMessageTemplateList />
      </Section>
    </AdminPage>
  );
}
