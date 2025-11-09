// src/features/cardTag/components/AdminCardTagEdit/index.tsx

import type { CardTag } from "@/features/cardTag/entities";
import { Suspense } from "react";
import EditCardTagForm from "../common/EditCardTagForm";
import { FormSkeleton } from "@/components/Feedback/Skeleton/FormSkeleton";

type Props = {
  cardTag: CardTag;
  redirectPath?: string;
};

export default function AdminCardTagEdit({ cardTag, redirectPath }: Props) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <EditCardTagForm cardTag={cardTag} redirectPath={redirectPath} />
    </Suspense>
  );
}
