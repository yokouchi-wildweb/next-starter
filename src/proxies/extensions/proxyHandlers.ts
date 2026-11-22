// 生成物・編集不可: pnpm generate extensions が src/proxies/extensionPoints.ts から生成する
// proxyHandlers: 差す側の <ドメイン>/plugs/proxyHandlers/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const handler と段 export const stage(並びは段(maintenance → mode → gate → redirect → main。骨組みだけの段 gate・redirect)→ <差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)

import type { ProxyHandler } from "@/proxies/points";

import { handler as proxyHandlers_setting_maintenance } from "@/domains/core/setting/plugs/proxyHandlers/maintenance";
import { handler as proxyHandlers_demo_demoMode } from "@/domains/core/demo/plugs/proxyHandlers/demoMode";

export const proxyHandlers: { domain: string | null; name: string; requires: readonly string[]; stage: "maintenance" | "mode" | "gate" | "redirect" | "main"; plug: ProxyHandler }[] = [
  { domain: "setting", name: "maintenance", requires: [], stage: "maintenance", plug: proxyHandlers_setting_maintenance },
  { domain: "demo", name: "demoMode", requires: [], stage: "mode", plug: proxyHandlers_demo_demoMode },
];
