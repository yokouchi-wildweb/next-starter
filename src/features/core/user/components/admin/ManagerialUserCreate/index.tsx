// src/features/user/components/admin/ManagerialUserCreate/index.tsx

import { Suspense } from "react";

import { FormSkeleton } from "@/components/Skeleton/FormSkeleton";
import { AdminManagerialUserCreateForm as ManagerialUserCreateForm } from "../../forms";

type Props = {
  redirectPath?: string;
};

export default function ManagerialUserCreate({ redirectPath }: Props) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <ManagerialUserCreateForm redirectPath={redirectPath} />
    </Suspense>
  );
}
