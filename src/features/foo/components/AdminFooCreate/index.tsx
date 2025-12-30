// src/features/foo/components/AdminFooCreate/index.tsx

import { Suspense } from "react";
import CreateFooForm from "../common/CreateFooForm";
import { FormSkeleton } from "@/components/Skeleton/FormSkeleton";

export type AdminFooCreateProps = {
  redirectPath?: string;
};

export default function AdminFooCreate({ redirectPath }: AdminFooCreateProps) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <CreateFooForm redirectPath={redirectPath} />
    </Suspense>
  );
}
