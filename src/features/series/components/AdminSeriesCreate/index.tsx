// src/features/series/components/AdminSeriesCreate/index.tsx

import CreateSeriesForm from "../common/CreateSeriesForm";
import { Suspense } from "react";
import { FormSkeleton } from "@/components/Feedback/Skeleton/FormSkeleton";

type Props = {
  redirectPath?: string;
};

export default function AdminSeriesCreate({ redirectPath }: Props) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <CreateSeriesForm redirectPath={redirectPath} />
    </Suspense>
  );
}
