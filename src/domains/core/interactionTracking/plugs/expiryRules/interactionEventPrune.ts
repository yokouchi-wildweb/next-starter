// src/domains/core/interactionTracking/plugs/expiryRules/interactionEventPrune.ts
// 増設点 expiryRules の項目: 反応の明細(interaction_events、user_id を持つ)を行ごとの保持日数が過ぎたら消す(集計の表は残る)。個人情報の削除
// 今の削除 interaction-event-prune(services/server/pruning.ts の pruneExpiredInteractionEvents) と同じ行を消す(旧 cron は区切り expiry-retire-crons まで残る。二重に消しても同じ)

import type { ExpiryRule } from "@/lib/cron/points";

export const rule: ExpiryRule = {
  table: "interaction_events",
  key: "id",
  rule: { kind: "rowDays", column: "created_at", daysColumn: "retention_days" },
  pii: true,
};
