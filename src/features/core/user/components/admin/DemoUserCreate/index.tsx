// src/features/user/components/admin/DemoUserCreate/index.tsx

import { Suspense } from "react";

import { FormSkeleton } from "@/components/Skeleton/FormSkeleton";
import DemoUserCreateForm from "../../forms/AdminDemoUserCreateForm";

type Props = {
  redirectPath?: string;
};

export default function DemoUserCreate({ redirectPath }: Props) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <DemoUserCreateForm redirectPath={redirectPath} />
    </Suspense>
  );
}
