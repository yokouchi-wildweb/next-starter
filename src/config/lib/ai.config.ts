// src/config/lib/ai.config.ts
// AI エージェント基盤の設定の上書き(@lib-config/ai)。値はリテラルで書く。キーと既定: src/lib/ai/config.ts
// 例: `export default { model: "claude-sonnet-5", maxIterations: 8 } satisfies AiOverride;`
import type { AiOverride } from "@/lib/ai";

export default {} satisfies AiOverride;
