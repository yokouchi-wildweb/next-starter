// src/features/cardRarity/components/AdminCardRarityEdit/index.tsx

import type { CardRarity } from "@/features/cardRarity/entities";
import EditCardRarityForm from "../common/EditCardRarityForm";
import { Suspense } from "react";
import { FormSkeleton } from "@/components/Feedback/Skeleton/FormSkeleton";

type Props = {
  rarity: CardRarity;
  redirectPath?: string;
};

export default function AdminCardRarityEdit({ rarity, redirectPath }: Props) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <EditCardRarityForm rarity={rarity} redirectPath={redirectPath} />
    </Suspense>
  );
}
