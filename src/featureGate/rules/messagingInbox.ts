// src/featureGate/rules/messagingInbox.ts
// 連絡の受け取り箱の一覧のページ /messages(D53・D57)。閉の間、そのページは 404。
// 利用者の API /api/me/messaging/inbox と表は常に開(fork が自前の一覧・ベルを持つため。D57)なので domains は持たない。
// 未読のモーダル(利用者の枠が置く)もこの門が閉なら出ない(取りに行かない)。開の間に出すかは messagingConfig.inbox.showUnreadModal。
// 入切の既定は閉(defaultEnabled: false)。fork が開ける値は src/config/featureGate/switches.config.ts(D35)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: [
    "/messages",
  ],
  domains: [],
  defaultEnabled: false,
};
