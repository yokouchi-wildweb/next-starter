// src/features/notificationTemplate/components/AdminNotificationTemplateList/index.tsx

import type { NotificationTemplate } from "@/features/core/notificationTemplate/entities";
import Header from "./Header";
import Table from "./Table";
import { Section } from "@/components/Layout/Section";

export type AdminNotificationTemplateListProps = {
  notificationTemplates: NotificationTemplate[];
  page: number;
  perPage: number;
  total: number;
};

export default function AdminNotificationTemplateList({
  notificationTemplates,
  page,
  perPage,
  total,
}: AdminNotificationTemplateListProps) {
  return (
    <Section>
      <Header page={page} perPage={perPage} total={total} />
      <Table notificationTemplates={notificationTemplates} />
    </Section>
  );
}
