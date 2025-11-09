// src/features/bar/components/AdminBarCreate/index.tsx

import { Suspense } from "react";
import CreateBarForm from "../common/CreateBarForm";
import { FormSkeleton } from "@/components/Feedback/Skeleton/FormSkeleton";

export type AdminBarCreateProps = {
  redirectPath?: string;
};

export default function AdminBarCreate({ redirectPath }: AdminBarCreateProps) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <CreateBarForm redirectPath={redirectPath} />
    </Suspense>
  );
}
