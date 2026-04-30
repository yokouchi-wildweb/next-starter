// src/app/admin/(protected)/audit-logs/page.tsx

import AdminPage from "@/components/AppFrames/Admin/Layout/AdminPage";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import { Section } from "@/components/Layout/Section";

import { AuditLogSearchPanel } from "./_components/AuditLogSearchPanel";

export const dynamic = "force-dynamic";

export default function AdminAuditLogsPage() {
  return (
    <AdminPage>
      <PageTitle>監査ログ</PageTitle>
      <Section>
        <AuditLogSearchPanel />
      </Section>
    </AdminPage>
  );
}
