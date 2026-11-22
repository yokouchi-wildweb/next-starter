// src/domains/userTag/components/AdminUserTagEdit/index.tsx

import { Suspense } from "react";
import EditUserTagForm from "../common/EditUserTagForm";
import type { UserTag } from "@/domains/core/userTag/entities";
import { FormSkeleton } from "@/components/Skeleton/FormSkeleton";

export type AdminUserTagEditProps = {
  userTag: UserTag;
  redirectPath?: string;
};

export default function AdminUserTagEdit({ userTag, redirectPath }: AdminUserTagEditProps) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <EditUserTagForm userTag={userTag} redirectPath={redirectPath} />
    </Suspense>
  );
}
