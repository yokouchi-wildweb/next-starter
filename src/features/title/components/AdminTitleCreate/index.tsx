// src/features/title/components/AdminTitleCreate/index.tsx

import { Suspense } from "react";
import CreateTitleForm from "../common/CreateTitleForm";
import { FormSkeleton } from "@/components/Feedback/Skeleton/FormSkeleton";

type Props = {
  redirectPath?: string;
};

export default function AdminTitleCreate({ redirectPath }: Props) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <CreateTitleForm redirectPath={redirectPath} />
    </Suspense>
  );
}
