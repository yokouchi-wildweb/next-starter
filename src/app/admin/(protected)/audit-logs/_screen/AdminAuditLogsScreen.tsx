// src/app/admin/(protected)/audit-logs/_screen/AdminAuditLogsScreen.tsx
// /admin/audit-logs の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける。
// 手順: src/lib/screens/README.md
//
// loader は無い(検索はこのルートの部品 AuditLogSearchPanel が hook で行う)。

import AdminPage from "@/app/admin/_layout/AdminPage";
import PageTitle from "@/app/admin/_layout/PageTitle";
import { Section } from "@/components/Layout/Section";

import { AuditLogSearchPanel } from "./AuditLogSearchPanel";

export const metadata = {
  title: "監査ログ",
};

export function AdminAuditLogsScreen() {
  return (
    <AdminPage>
      <PageTitle placement="header">監査ログ</PageTitle>
      <Section>
        <AuditLogSearchPanel />
      </Section>
    </AdminPage>
  );
}
