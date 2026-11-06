// scripts/structure/cron/discover.ts — cron の task を探す処理(src/lib/cron/discover.ts)に門番を結ぶ薄い呼び手
// 利用者: scripts/structure/cron/generate.ts, check.ts, cronWiring.test.mjs, scripts/runner/task/run.ts（pnpm task）, scripts/structure/proxies/walletOff.test.tsx
import { gate } from "@/featureGate/node";
import {
  type CronPathClosedBy,
  type LoadCronTasksOptions,
  type LoadedCronTask,
  loadCronTasks as loadCronTasksWith,
} from "@/lib/cron/discover";

export { CRON_OVERRIDE_FILE, CRON_ROUTE_DIR, listCronTaskDirs, scheduledCronTasks } from "@/lib/cron/discover";
export type { CronPathClosedBy, LoadCronTasksOptions, LoadedCronTask };

/** 既定の判定: 門番の configPath（今の config の値で評価する。全開スイッチは通さない） */
export const gateClosedBy: CronPathClosedBy = (pathname) => {
  const result = configPath(pathname);
  return result.open ? null : result.rule;
};

/** 全タスクの task.ts（と task.override.ts）を読み込む。closedBy の既定 = 門番 */
export function loadCronTasks(repoRoot: string, options: Partial<LoadCronTasksOptions> = {}): Promise<LoadedCronTask[]> {
  return loadCronTasksWith(repoRoot, { closedBy: options.closedBy ?? gateClosedBy });
}
