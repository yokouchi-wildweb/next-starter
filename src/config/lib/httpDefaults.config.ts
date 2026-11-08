// src/config/lib/httpDefaults.config.ts
// client の HTTP の既定の上書き(@lib-config/httpDefaults)。値はリテラルで書く。キーと既定: src/lib/httpDefaults/README.md
// 例: export default { timeoutMs: 30_000 } satisfies HttpDefaultsOverride;
import type { HttpDefaultsOverride } from "@/lib/httpDefaults";

export default {} satisfies HttpDefaultsOverride;
