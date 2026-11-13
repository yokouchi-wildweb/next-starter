// src/featureGate/rules/messagingBroadcast.ts
// 管理の送信(D34・D40・D87): API /api/admin/messaging/send(送る・予約・プレビュー・見込み・自分へのテスト・選択肢)と、
// 回の一覧・詳細の送るモーダルの口(「新しく送る」「同じ内容で送る」。部品が useGate で出し分ける)。送る画面のページは無い(モーダルにたたんだ)。
// 閉の間、API は 404、口は出ない。管理一覧の一括送信(bulkMessageAction・/api/admin/messaging/bulk-send/**)はこの門の外。
// 送る口(sendMessage / sendTemplate)と cron の予約の拾いは門に関わらず動く(domains は持たない)。
// /admin/messaging の下の機能なので messagingDispatches に依存する。
// 入切の既定は閉。fork が開ける値は src/config/featureGate/switches.config.ts

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  dependsOn: ["messagingDispatches"],
  pathPatterns: [
    "/api/admin/messaging/send",
  ],
  domains: [],
  defaultEnabled: false,
};
