// src/features/series/components/AdminSeriesEdit/index.tsx

import type { Series } from "@/features/series/entities";
import EditSeriesForm from "../common/EditSeriesForm";
import { Suspense } from "react";
import { FormSkeleton } from "@/components/Feedback/Skeleton/FormSkeleton";

type Props = {
  series: Series;
  redirectPath?: string;
};

export default function AdminSeriesEdit({ series, redirectPath }: Props) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <EditSeriesForm series={series} redirectPath={redirectPath} />
    </Suspense>
  );
}
