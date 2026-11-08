// src/config/lib/drizzle.config.ts
// drizzle の接続プールの設定の上書き(@lib-config/drizzle)。値はリテラルで書く(process.env は読んでよい)。キーと既定: src/lib/drizzle/README.md
import type { DrizzleOverride } from "@/lib/drizzle";

export default {} satisfies DrizzleOverride;
