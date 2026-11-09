// src/config/features/admin.config.ts
// 管理(ダッシュボード・管理の一覧の表)の設定の上書き(持ち主 src/features/core/admin/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
// 例: `export default { dashboard: { showMainMetrics: true } } satisfies AdminOverride;`
import type { AdminOverride } from "@/features/admin/config";

export default {} satisfies AdminOverride;
