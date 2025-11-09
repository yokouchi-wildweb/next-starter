// src/features/bar/components/AdminBarEdit/index.tsx

import { Suspense } from "react";
import EditBarForm from "../common/EditBarForm";
import type { Bar } from "../../entities";
import { FormSkeleton } from "@/components/Feedback/Skeleton/FormSkeleton";

export type AdminBarEditProps = {
  bar: Bar;
  redirectPath?: string;
};

export default function AdminBarEdit({ bar, redirectPath }: AdminBarEditProps) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <EditBarForm bar={bar} redirectPath={redirectPath} />
    </Suspense>
  );
}
