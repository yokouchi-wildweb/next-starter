// src/config/features/userCounter.config.ts
// per-user カウンタの設定の上書き(持ち主 src/features/core/userCounter/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
// 日次の保持日数と日界を変える: `export default { defaultRetentionDays: 365, dailyTimeZone: "UTC" } satisfies UserCounterOverride;`
import type { UserCounterOverride } from "@/features/userCounter/config";

export default {} satisfies UserCounterOverride;
