// src/features/user/components/admin/ManagerialUserEdit/index.tsx

import { Suspense } from "react";

import type { User } from "@/features/core/user/entities";
import { FormSkeleton } from "@/components/Skeleton/FormSkeleton";
import ManagerialUserEditForm from "../form/ManagerialUserEditForm";

type Props = {
  user: User;
  redirectPath?: string;
};

export default function ManagerialUserEdit({ user, redirectPath }: Props) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <ManagerialUserEditForm user={user} redirectPath={redirectPath} />
    </Suspense>
  );
}
