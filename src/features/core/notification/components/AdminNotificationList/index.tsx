// src/features/notification/components/AdminNotificationList/index.tsx

import type { Notification } from "@/features/core/notification/entities";
import Header from "./Header";
import Table from "./Table";
import { Section } from "@/components/Layout/Section";

export type AdminNotificationListProps = {
  notifications: Notification[];
  page: number;
  perPage: number;
  total: number;
};

export default function AdminNotificationList({
  notifications,
  page,
  perPage,
  total,
}: AdminNotificationListProps) {
  return (
    <Section>
      <Header page={page} perPage={perPage} total={total} />
      <Table notifications={notifications} />
    </Section>
  );
}
