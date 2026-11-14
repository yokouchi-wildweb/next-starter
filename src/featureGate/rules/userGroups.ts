// src/featureGate/rules/userGroups.ts
// ユーザーグループ(D99・D103)。ドメイン userGroup ごと閉じる: 表・汎用 API・cron・管理画面 /admin/user-groups とその API。
// 閉の時は評価の口が「使えない」を返し(1 人の確かめを黙って false・全員に置き換えない)、グループを使う機能は自分の依存として
// この門を見て、閉ならグループの選択肢を出さない。
// 入切の既定は閉(defaultEnabled: false)。fork が開ける値は src/config/featureGate/switches.config.ts(D35)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/admin/user-groups",
    "/api/admin/user-groups",
  ],
  domains: [
    "core/userGroup",
  ],
  defaultEnabled: false,
};
