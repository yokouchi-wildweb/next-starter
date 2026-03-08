// src/features/notification/components/AdminNotificationEdit/index.tsx

import { Suspense } from "react";
import EditNotificationForm from "../common/EditNotificationForm";
import type { Notification } from "@/features/notification/entities";
import { FormSkeleton } from "@/components/Skeleton/FormSkeleton";

export type AdminNotificationEditProps = {
  notification: Notification;
  redirectPath?: string;
};

export default function AdminNotificationEdit({ notification, redirectPath }: AdminNotificationEditProps) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <EditNotificationForm notification={notification} redirectPath={redirectPath} />
    </Suspense>
  );
}
