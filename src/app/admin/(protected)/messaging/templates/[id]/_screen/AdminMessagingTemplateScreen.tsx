// src/app/admin/(protected)/messaging/templates/[id]/_screen/AdminMessagingTemplateScreen.tsx
// /admin/messaging/templates/[id] の既定画面(page 層の本体。テンプレートを直す・公開・取り下げ・版の履歴)。上流所有。
// 下流は編集・削除せず、差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。
// 手順: src/lib/screens/README.md

import AdminPage from "@/app/admin/_layout/AdminPage";
import { LinkButton } from "@/components/Form/Button";
import { Section } from "@/components/Layout/Section";
import type { ScreenProps } from "@/lib/screens/types";
import { AdminMessageTemplateEditor } from "@/features/core/messaging/components/AdminMessageTemplateEditor";

import { loadAdminMessagingTemplateScreen, type AdminMessagingTemplateScreenParams } from "./loader";

export const metadata = {
  title: "テンプレート",
};

export async function AdminMessagingTemplateScreen(props: ScreenProps<AdminMessagingTemplateScreenParams>) {
  const { templateId } = await loadAdminMessagingTemplateScreen(props);

  return (
    <AdminPage
      title="テンプレート"
      actions={
        <LinkButton href="/admin/messaging/templates" size="sm" variant="outline">
          一覧へ
        </LinkButton>
      }
    >
      <Section>
        <AdminMessageTemplateEditor templateId={templateId} />
      </Section>
    </AdminPage>
  );
}
