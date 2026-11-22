// src/lib/startup/index.ts
// 起動時の処理の入口(閉じた lib)。結び目は生成物 src/wiring/startup.ts(宣言 ./extensionPoints.ts の wire)、入口は src/instrumentation.ts の register。
// 約束の型もこの入口から(型だけの入口は段 3 の lint の札で決める)
export { createStartup, type Startup } from "./createStartup";
export { wireStartup, currentRuntime, STARTUP_TIMEOUT_MS, type StartupLists } from "./wire";
export type { StartupOptions, StartupRuntime, StartupTask, StartupTaskLoader } from "./types";
