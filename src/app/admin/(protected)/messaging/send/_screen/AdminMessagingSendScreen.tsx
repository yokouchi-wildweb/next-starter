// src/app/admin/(protected)/messaging/send/_screen/AdminMessagingSendScreen.tsx
// /admin/messaging/send の既定画面(page 層の本体。連絡を送る)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import AdminPage from "@/app/admin/_layout/AdminPage";
import { LinkButton } from "@/components/Form/Button";
import { Section } from "@/components/Layout/Section";
import type { ScreenProps } from "@/lib/screens/types";
import { AdminMessageComposer } from "@/features/core/messaging/components/AdminMessageComposer";

import { loadAdminMessagingSendScreen } from "./loader";

export const metadata = {
  title: "連絡を送る",
};

export async function AdminMessagingSendScreen(props: ScreenProps) {
  await loadAdminMessagingSendScreen(props);

  return (
    <AdminPage
      title="連絡を送る"
      actions={
        <LinkButton href="/admin/messaging" size="sm" variant="outline">
          送信の履歴
        </LinkButton>
      }
    >
      <Section>
        <AdminMessageComposer />
      </Section>
    </AdminPage>
  );
}
