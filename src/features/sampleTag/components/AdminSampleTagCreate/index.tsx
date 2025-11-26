// src/features/sampleTag/components/AdminSampleTagCreate/index.tsx

import { Suspense } from "react";
import CreateSampleTagForm from "../common/CreateSampleTagForm";
import { FormSkeleton } from "@/components/Skeleton/FormSkeleton";

export type AdminSampleTagCreateProps = {
  redirectPath?: string;
};

export default function AdminSampleTagCreate({ redirectPath }: AdminSampleTagCreateProps) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <CreateSampleTagForm redirectPath={redirectPath} />
    </Suspense>
  );
}
