// src/features/user/components/admin/GeneralUserCreate/index.tsx

import { Suspense } from "react";

import { FormSkeleton } from "@/components/Skeleton/FormSkeleton";
import GeneralUserCreateForm from "../form/GeneralUserCreateForm";

type Props = {
  redirectPath?: string;
};

export default function GeneralUserCreate({ redirectPath }: Props) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <GeneralUserCreateForm redirectPath={redirectPath} />
    </Suspense>
  );
}
