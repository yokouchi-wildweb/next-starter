// src/config/features/accountLifecycle.config.ts
// 休会・退会・復帰の設定の上書き(持ち主 src/features/core/accountLifecycle/config.ts だけが読む)。値はリテラルで書く。キーと既定: 持ち主の config.ts
// 退会の画面の説明文を変える: `export default { withdraw: { description: "…" } } satisfies AccountLifecycleOverride;`
import type { AccountLifecycleOverride } from "@/features/accountLifecycle/config";

export default {} satisfies AccountLifecycleOverride;
