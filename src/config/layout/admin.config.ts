// src/config/layout/admin.config.ts
// 管理の枠の設定の上書き(持ち主 src/app/admin/_layout/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
// 例: `export default { enableSidebarResizing: false } satisfies AdminLayoutOverride;`
import type { AdminLayoutOverride } from "@/app/admin/_layout/config";

export default {} satisfies AdminLayoutOverride;
