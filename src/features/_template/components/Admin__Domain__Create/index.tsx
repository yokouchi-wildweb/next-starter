// src/features/__domain__/components/Admin__Domain__Create/index.tsx

import { Suspense } from "react";
import Create__Domain__Form from "../common/Create__Domain__Form";
import { FormSkeleton } from "@/components/Feedback/Skeleton/FormSkeleton";

export type Admin__Domain__CreateProps = {
  redirectPath?: string;
};

export default function Admin__Domain__Create({ redirectPath }: Admin__Domain__CreateProps) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <Create__Domain__Form redirectPath={redirectPath} />
    </Suspense>
  );
}
