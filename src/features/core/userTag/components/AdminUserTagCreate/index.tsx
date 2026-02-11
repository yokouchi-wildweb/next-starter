// src/features/userTag/components/AdminUserTagCreate/index.tsx

import { Suspense } from "react";
import CreateUserTagForm from "../common/CreateUserTagForm";
import { FormSkeleton } from "@/components/Skeleton/FormSkeleton";

export type AdminUserTagCreateProps = {
  redirectPath?: string;
};

export default function AdminUserTagCreate({ redirectPath }: AdminUserTagCreateProps) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <CreateUserTagForm redirectPath={redirectPath} />
    </Suspense>
  );
}
