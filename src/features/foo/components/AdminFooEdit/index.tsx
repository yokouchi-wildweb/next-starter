// src/features/foo/components/AdminFooEdit/index.tsx

import { Suspense } from "react";
import EditFooForm from "../common/EditFooForm";
import type { Foo } from "@/features/foo/entities";
import { FormSkeleton } from "@/components/Skeleton/FormSkeleton";

export type AdminFooEditProps = {
  foo: Foo;
  redirectPath?: string;
};

export default function AdminFooEdit({ foo, redirectPath }: AdminFooEditProps) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <EditFooForm foo={foo} redirectPath={redirectPath} />
    </Suspense>
  );
}
