// src/app/admin/(protected)/messaging/templates/new/_screen/AdminMessagingTemplateCreateScreen.tsx
// /admin/messaging/templates/new の既定画面(page 層の本体。テンプレートを作る)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import AdminPage from "@/app/admin/_layout/AdminPage";
import { LinkButton } from "@/components/Form/Button";
import { Section } from "@/components/Layout/Section";
import type { ScreenProps } from "@/lib/screens/types";
import { AdminMessageTemplateEditor } from "@/features/core/messaging/components/AdminMessageTemplateEditor";

import { loadAdminMessagingTemplateCreateScreen } from "./loader";

export const metadata = {
  title: "テンプレートを作る",
};

export async function AdminMessagingTemplateCreateScreen(props: ScreenProps) {
  await loadAdminMessagingTemplateCreateScreen(props);

  return (
    <AdminPage
      title="テンプレートを作る"
      actions={
        <LinkButton href="/admin/messaging/templates" size="sm" variant="outline">
          一覧へ
        </LinkButton>
      }
    >
      <Section>
        <AdminMessageTemplateEditor />
      </Section>
    </AdminPage>
  );
}
