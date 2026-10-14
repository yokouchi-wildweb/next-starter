// src/components/Form/Input/Manual/AsyncOptionSource/PendingOptionLabel.tsx
//
// ラベル未解決（initialOptions 到着前 / cache 未収録）時の代替表示。

import { BaseSkeleton } from "@/components/Skeleton/BaseSkeleton";

export function PendingOptionLabel() {
  return <BaseSkeleton className="h-4 w-32 rounded" backgroundTone="subtle" />;
}
