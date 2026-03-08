// src/features/notificationTemplate/components/AdminNotificationTemplateEdit/index.tsx

import { Suspense } from "react";
import EditNotificationTemplateForm from "../common/EditNotificationTemplateForm";
import type { NotificationTemplate } from "@/features/core/notificationTemplate/entities";
import { FormSkeleton } from "@/components/Skeleton/FormSkeleton";

export type AdminNotificationTemplateEditProps = {
  notificationTemplate: NotificationTemplate;
  redirectPath?: string;
};

export default function AdminNotificationTemplateEdit({ notificationTemplate, redirectPath }: AdminNotificationTemplateEditProps) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <EditNotificationTemplateForm notificationTemplate={notificationTemplate} redirectPath={redirectPath} />
    </Suspense>
  );
}
