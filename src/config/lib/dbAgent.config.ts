// src/config/lib/dbAgent.config.ts
// DB 調査エージェントの設定の上書き(@lib-config/dbAgent)。値はリテラルで書く。キーと既定: src/lib/dbAgent/config.ts
// 例: `export default { maxRows: 500, statementTimeoutMs: 20_000 } satisfies DbAgentOverride;`
import type { DbAgentOverride } from "@/lib/dbAgent";

export default {} satisfies DbAgentOverride;
