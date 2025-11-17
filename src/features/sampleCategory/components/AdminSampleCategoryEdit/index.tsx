// src/features/sampleCategory/components/AdminSampleCategoryEdit/index.tsx

import { Suspense } from "react";
import EditSampleCategoryForm from "../common/EditSampleCategoryForm";
import type { SampleCategory } from "../../entities";
import { FormSkeleton } from "@/components/Feedback/Skeleton/FormSkeleton";

export type AdminSampleCategoryEditProps = {
  sampleCategory: SampleCategory;
  redirectPath?: string;
};

export default function AdminSampleCategoryEdit({ sampleCategory, redirectPath }: AdminSampleCategoryEditProps) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <EditSampleCategoryForm sampleCategory={sampleCategory} redirectPath={redirectPath} />
    </Suspense>
  );
}
