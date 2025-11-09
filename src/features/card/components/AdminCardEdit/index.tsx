// src/features/card/components/AdminCardEdit/index.tsx

import type { CardWithRelations } from "@/features/card/entities";
import { Suspense } from "react";
import EditCardForm from "../common/EditCardForm";
import { FormSkeleton } from "@/components/Feedback/Skeleton/FormSkeleton";

type Props = {
  card: CardWithRelations;
  redirectPath?: string;
};

export default function AdminCardEdit({ card, redirectPath }: Props) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <EditCardForm card={card} redirectPath={redirectPath} />
    </Suspense>
  );
}
