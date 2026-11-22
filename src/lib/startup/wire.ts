// src/lib/startup/wire.ts
// 結び目の作り手(D31): 生成物 src/wiring/startup.ts が、門番で絞った起動時の処理の一覧を渡して 1 つの startup を作る(宣言 ./extensionPoints.ts の wire)。
// 待ち時間の上限はここに持ち、いまの runtime は Next の edge の目印(globalThis.EdgeRuntime)で見る(env は読まない)
import { createStartup, type Startup } from "./createStartup";
import type { StartupTaskLoader } from "./types";

/** 項目 1 つの待ち時間の上限(起動を止め続けない) */
export const STARTUP_TIMEOUT_MS = 10000;

/** いまの runtime: Next は edge の束にだけ globalThis.EdgeRuntime(文字列)を置く。無ければ nodejs */
export const currentRuntime = (): "nodejs" | "edge" => (typeof (globalThis as { EdgeRuntime?: unknown }).EdgeRuntime === "string" ? "edge" : "nodejs");

/** 生成物が渡す一覧(点 startupTasks、項目は lazy) */
export type StartupLists = { startupTasks: readonly StartupTaskLoader[] };

export function wireStartup(lists: StartupLists): Startup {
  return createStartup(lists.startupTasks, { runtime: currentRuntime(), timeoutMs: STARTUP_TIMEOUT_MS });
}
