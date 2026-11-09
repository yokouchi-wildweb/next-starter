// src/config/proxies/demo.config.ts
// proxy のデモのテーマの設定の上書き(持ち主 src/proxies/demo/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
// 例: `export default { enabled: true, allowedPrefixes: ["/_next", "/api", "/assets"] } satisfies DemoOverride;`
import type { DemoOverride } from "@/proxies/demo/config";

export default {} satisfies DemoOverride;
