// 生成物・編集不可: pnpm generate extensions が src/lib/startup/extensionPoints.ts から生成する
// startupTasks: 差す側の <ドメイン>/plugs/startupTasks/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const task(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)
// 結び目: src/lib/startup/extensionPoints.ts の wire(一覧を門番で絞って lib の wireStartup に渡す)

import { gate } from "@/featureGate";
import { wireStartup } from "@/lib/startup";

import type { StartupTask } from "@/lib/startup/points";

export const startupTasks: { domain: string | null; name: string; requires: readonly string[]; load: () => Promise<StartupTask> }[] = [
  { domain: null, name: "mailBackendStatus", requires: [], load: async () => { if (process.env.NEXT_RUNTIME === "nodejs") { const { createBackendStatusTask } = await import("@/lib/backends"); const { mailBackendStatus } = await import("@/lib/mail"); return createBackendStatusTask(mailBackendStatus); } return { name: "backends.mail", runtime: "nodejs", run: () => {} }; } },
];

export const startup = wireStartup({ startupTasks: gate.plugs(startupTasks) });
