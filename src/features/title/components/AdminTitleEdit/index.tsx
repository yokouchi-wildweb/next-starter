// src/features/title/components/AdminTitleEdit/index.tsx

import type { Title } from "@/features/title/entities";
import { Suspense } from "react";
import EditTitleForm from "../common/EditTitleForm";
import { FormSkeleton } from "@/components/Feedback/Skeleton/FormSkeleton";

type Props = {
  title: Title;
  redirectPath?: string;
};

export default function AdminTitleEdit({ title, redirectPath }: Props) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <EditTitleForm title={title} redirectPath={redirectPath} />
    </Suspense>
  );
}
