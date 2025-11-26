// src/features/sampleTag/components/AdminSampleTagEdit/index.tsx

import { Suspense } from "react";
import EditSampleTagForm from "../common/EditSampleTagForm";
import type { SampleTag } from "@/features/sampleTag/entities";
import { FormSkeleton } from "@/components/Skeleton/FormSkeleton";

export type AdminSampleTagEditProps = {
  sampleTag: SampleTag;
  redirectPath?: string;
};

export default function AdminSampleTagEdit({ sampleTag, redirectPath }: AdminSampleTagEditProps) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <EditSampleTagForm sampleTag={sampleTag} redirectPath={redirectPath} />
    </Suspense>
  );
}
