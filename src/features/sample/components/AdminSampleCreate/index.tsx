// src/features/sample/components/AdminSampleCreate/index.tsx

import { Suspense } from "react";
import CreateSampleForm from "../common/CreateSampleForm";
import { FormSkeleton } from "@/components/Skeleton/FormSkeleton";

export type AdminSampleCreateProps = {
  redirectPath?: string;
};

export default function AdminSampleCreate({ redirectPath }: AdminSampleCreateProps) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <CreateSampleForm redirectPath={redirectPath} />
    </Suspense>
  );
}
