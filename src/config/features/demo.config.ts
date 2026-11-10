// src/config/features/demo.config.ts
// デモの設定の上書き(持ち主 src/features/core/demo/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
// 例: `export default { mode: { enabled: true, allowedPrefixes: ["/_next", "/api", "/assets"] }, session: { maxAgeSeconds: 1800 } } satisfies DemoOverride;`
import type { DemoOverride } from "@/features/demo/config";

export default {} satisfies DemoOverride;
