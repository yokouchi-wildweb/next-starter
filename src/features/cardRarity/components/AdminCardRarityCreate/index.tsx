// src/features/cardRarity/components/AdminCardRarityCreate/index.tsx

import CreateCardRarityForm from "../common/CreateCardRarityForm";
import { Suspense } from "react";
import { FormSkeleton } from "@/components/Feedback/Skeleton/FormSkeleton";

type Props = {
  redirectPath?: string;
};

export default function AdminCardRarityCreate({ redirectPath }: Props) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <CreateCardRarityForm redirectPath={redirectPath} />
    </Suspense>
  );
}
