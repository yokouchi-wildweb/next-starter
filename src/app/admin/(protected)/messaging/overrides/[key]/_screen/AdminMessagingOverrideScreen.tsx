// src/app/admin/(protected)/messaging/overrides/[key]/_screen/AdminMessagingOverrideScreen.tsx
// /admin/messaging/overrides/[key] の既定画面(page 層の本体。1 連絡の文言の上書き)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import AdminPage from "@/app/admin/_layout/AdminPage";
import { LinkButton } from "@/components/Form/Button";
import { Section } from "@/components/Layout/Section";
import type { ScreenProps } from "@/lib/screens/types";
import { AdminMessageOverrideEditor } from "@/features/core/messaging/components/AdminMessageOverrideEditor";

import { loadAdminMessagingOverrideScreen, type AdminMessagingOverrideScreenParams } from "./loader";

export const metadata = {
  title: "文言の上書き",
};

export async function AdminMessagingOverrideScreen(props: ScreenProps<AdminMessagingOverrideScreenParams>) {
  const { messageKey } = await loadAdminMessagingOverrideScreen(props);

  return (
    <AdminPage
      title="文言の上書き"
      actions={
        <LinkButton href="/admin/messaging/overrides" size="sm" variant="outline">
          一覧へ
        </LinkButton>
      }
    >
      <Section>
        <AdminMessageOverrideEditor messageKey={messageKey} />
      </Section>
    </AdminPage>
  );
}
