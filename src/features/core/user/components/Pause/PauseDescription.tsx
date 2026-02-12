// src/features/core/user/components/Pause/PauseDescription.tsx

import { Para } from "@/components/TextBlocks";

export function PauseDescription() {
  return (
    <Para tone="muted" size="sm" className="mt-0">
      休会すると、アカウントは一時的に利用停止状態となります。
      休会中はサービスを利用できませんが、いつでも復帰することができます。
    </Para>
  );
}
