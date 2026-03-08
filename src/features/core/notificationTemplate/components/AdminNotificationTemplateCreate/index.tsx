// src/features/notificationTemplate/components/AdminNotificationTemplateCreate/index.tsx

import { Suspense } from "react";
import CreateNotificationTemplateForm from "../common/CreateNotificationTemplateForm";
import { FormSkeleton } from "@/components/Skeleton/FormSkeleton";

export type AdminNotificationTemplateCreateProps = {
  redirectPath?: string;
};

export default function AdminNotificationTemplateCreate({ redirectPath }: AdminNotificationTemplateCreateProps) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <CreateNotificationTemplateForm redirectPath={redirectPath} />
    </Suspense>
  );
}
