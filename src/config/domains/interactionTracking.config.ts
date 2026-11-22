// src/config/domains/interactionTracking.config.ts
// インタラクション計測の設定の上書き(持ち主 src/domains/core/interactionTracking/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
// 値を変える: `export default { defaultRetentionDays: 180 } satisfies InteractionTrackingOverride;`
import type { InteractionTrackingOverride } from "@/domains/interactionTracking/config";

export default {} satisfies InteractionTrackingOverride;
