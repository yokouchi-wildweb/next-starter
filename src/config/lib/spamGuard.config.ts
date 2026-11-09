// src/config/lib/spamGuard.config.ts
// 使い捨てメールの判定の設定の上書き(@lib-config/spamGuard)。値はリテラルで書く。キーと既定: src/lib/spamGuard/config.ts
// 例: 4 段階のフルチェックにする `export default { emailCheckMode: "full" } satisfies SpamGuardOverride;`
import type { SpamGuardOverride } from "@/lib/spamGuard";

export default {} satisfies SpamGuardOverride;
