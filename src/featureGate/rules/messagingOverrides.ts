// src/featureGate/rules/messagingOverrides.ts
// 管理画面の文言の上書き(D21・D24・D28): 管理の画面 /admin/messaging/overrides(一覧・[key] の編集)と API /api/admin/messaging/overrides と、送る口が message_overrides を重ねるか。
// 閉の間、画面と API は 404 で、送る口は DB の値を使わない(コードの値 = 上流 + fork の override)。表は門に関わらず残る(domains は持たない)。
// /admin/messaging の下の機能なので messagingDispatches に依存する。管理メニューの行(src/features/core/admin/menu/items/messagingOverrides.ts)はこの規則の住所で隠れる。
// 入切の既定は閉。fork が開ける値は src/config/featureGate/switches.config.ts

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  dependsOn: ["messagingDispatches"],
  pathPatterns: [
    "/admin/messaging/overrides",
    "/api/admin/messaging/overrides",
  ],
  domains: [],
  defaultEnabled: false,
};
