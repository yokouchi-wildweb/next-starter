// src/featureGate/rules/messagingOverrides.ts
// 管理画面の文言の上書き(D21・D24・D28): 管理の API /api/admin/messaging/overrides と、送る口が message_overrides を重ねるか。
// 閉の間、API は 404 で、送る口は DB の値を使わない(コードの値 = 上流 + fork の override)。表は門に関わらず残る(domains は持たない)。
// /admin/messaging の下の機能なので messagingDispatches に依存する。住所は今は API だけ(管理の画面の住所は画面と一緒に足す)。
// 入切の既定は閉。fork が開ける値は src/config/featureGate/switches.config.ts

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  dependsOn: ["messagingDispatches"],
  pathPatterns: [
    "/api/admin/messaging/overrides",
  ],
  domains: [],
  defaultEnabled: false,
};
