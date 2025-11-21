// src/features/__domain__/components/Admin__Domain__Edit/index.tsx

import { Suspense } from "react";
import Edit__Domain__Form from "../common/Edit__Domain__Form";
import type { __Domain__ } from "@/features/_template/entities";
import { FormSkeleton } from "@/components/Skeleton/FormSkeleton";

export type Admin__Domain__EditProps = {
  __domain__: __Domain__;
  redirectPath?: string;
};

export default function Admin__Domain__Edit({ __domain__, redirectPath }: Admin__Domain__EditProps) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <Edit__Domain__Form __domain__={__domain__} redirectPath={redirectPath} />
    </Suspense>
  );
}
