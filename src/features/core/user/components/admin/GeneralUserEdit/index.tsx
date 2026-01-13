// src/features/user/components/admin/GeneralUserEdit/index.tsx

import { Suspense } from "react";

import type { User } from "@/features/core/user/entities";
import { FormSkeleton } from "@/components/Skeleton/FormSkeleton";
import GeneralUserEditForm from "../form/GeneralUserEditForm";

type Props = {
  user: User;
  profileData?: Record<string, unknown>;
  redirectPath?: string;
};

export default function GeneralUserEdit({ user, profileData, redirectPath }: Props) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <GeneralUserEditForm user={user} profileData={profileData} redirectPath={redirectPath} />
    </Suspense>
  );
}
