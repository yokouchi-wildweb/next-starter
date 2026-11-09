// src/config/features/interactionTracking.config.ts
// インタラクション計測の設定の上書き(持ち主 src/features/core/interactionTracking/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
// 値を変える: `export default { defaultRetentionDays: 180 } satisfies InteractionTrackingOverride;`
import type { InteractionTrackingOverride } from "@/features/interactionTracking/config";

export default {} satisfies InteractionTrackingOverride;
