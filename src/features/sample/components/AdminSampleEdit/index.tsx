// src/features/sample/components/AdminSampleEdit/index.tsx

import { Suspense } from "react";
import EditSampleForm from "../common/EditSampleForm";
import type { Sample } from "../../entities";
import { FormSkeleton } from "@/components/Feedback/Skeleton/FormSkeleton";

export type AdminSampleEditProps = {
  sample: Sample;
  redirectPath?: string;
};

export default function AdminSampleEdit({ sample, redirectPath }: AdminSampleEditProps) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <EditSampleForm sample={sample} redirectPath={redirectPath} />
    </Suspense>
  );
}
