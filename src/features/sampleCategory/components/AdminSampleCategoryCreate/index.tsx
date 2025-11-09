// src/features/sampleCategory/components/AdminSampleCategoryCreate/index.tsx

import { Suspense } from "react";
import CreateSampleCategoryForm from "../common/CreateSampleCategoryForm";
import { FormSkeleton } from "@/components/Feedback/Skeleton/FormSkeleton";

export type AdminSampleCategoryCreateProps = {
  redirectPath?: string;
};

export default function AdminSampleCategoryCreate({ redirectPath }: AdminSampleCategoryCreateProps) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <CreateSampleCategoryForm redirectPath={redirectPath} />
    </Suspense>
  );
}
