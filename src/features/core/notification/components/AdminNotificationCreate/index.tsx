// src/features/notification/components/AdminNotificationCreate/index.tsx

import { Suspense } from "react";
import CreateNotificationForm from "../common/CreateNotificationForm";
import { FormSkeleton } from "@/components/Skeleton/FormSkeleton";

export type AdminNotificationCreateProps = {
  redirectPath?: string;
};

export default function AdminNotificationCreate({ redirectPath }: AdminNotificationCreateProps) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <CreateNotificationForm redirectPath={redirectPath} />
    </Suspense>
  );
}
