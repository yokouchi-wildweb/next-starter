// src/features/cardTag/components/AdminCardTagCreate/index.tsx

import { Suspense } from "react";
import CreateCardTagForm from "../common/CreateCardTagForm";
import { FormSkeleton } from "@/components/Feedback/Skeleton/FormSkeleton";

type Props = {
  redirectPath?: string;
};

export default function AdminCardTagCreate({ redirectPath }: Props) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <CreateCardTagForm redirectPath={redirectPath} />
    </Suspense>
  );
}
