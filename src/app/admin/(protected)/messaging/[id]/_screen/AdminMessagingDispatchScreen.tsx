// src/app/admin/(protected)/messaging/[id]/_screen/AdminMessagingDispatchScreen.tsx
// /admin/messaging/[id] の既定画面(page 層の本体。送った回 1 件と配達)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import AdminPage from "@/app/admin/_layout/AdminPage";
import { LinkButton } from "@/components/Form/Button";
import { Section } from "@/components/Layout/Section";
import type { ScreenProps } from "@/lib/screens/types";
import { AdminDispatchDetail } from "@/features/core/messaging/components/AdminDispatchDetail";

import { loadAdminMessagingDispatchScreen, type AdminMessagingDispatchScreenParams } from "./loader";

export const metadata = {
  title: "送信の詳細",
};

export async function AdminMessagingDispatchScreen(props: ScreenProps<AdminMessagingDispatchScreenParams>) {
  const { dispatchId } = await loadAdminMessagingDispatchScreen(props);

  return (
    <AdminPage
      title="送信の詳細"
      actions={
        <LinkButton href="/admin/messaging" size="sm" variant="outline">
          一覧へ
        </LinkButton>
      }
    >
      <Section>
        <AdminDispatchDetail dispatchId={dispatchId} />
      </Section>
    </AdminPage>
  );
}
