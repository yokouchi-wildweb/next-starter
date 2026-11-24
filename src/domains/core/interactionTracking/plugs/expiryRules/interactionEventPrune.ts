// src/domains/core/interactionTracking/plugs/expiryRules/interactionEventPrune.ts
// 増設点 expiryRules の項目: 反応の明細(interaction_events、user_id を持つ)を行ごとの保持日数が過ぎたら消す(集計の表は残る)。個人情報の削除
// 消す行: created_at + retention_days * 1 日 < 今(保持日数は記録の時に行へ書く: 規則の値か設定 defaultRetentionDays)

import type { ExpiryRule } from "@/lib/cron/points";

export const rule: ExpiryRule = {
  table: "interaction_events",
  key: "id",
  rule: { kind: "rowDays", column: "created_at", daysColumn: "retention_days" },
  pii: true,
};
