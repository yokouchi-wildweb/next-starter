// src/features/user/components/admin/ManagerialUserEdit/index.tsx

import { Suspense } from "react";

import type { User } from "@/features/core/user/entities";
import { FormSkeleton } from "@/components/Skeleton/FormSkeleton";
import ManagerialUserEditForm from "../../forms/AdminManagerialUserEditForm";

type Props = {
  user: User;
  profileData?: Record<string, unknown>;
  redirectPath?: string;
};

export default function ManagerialUserEdit({ user, profileData, redirectPath }: Props) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <ManagerialUserEditForm user={user} profileData={profileData} redirectPath={redirectPath} />
    </Suspense>
  );
}
