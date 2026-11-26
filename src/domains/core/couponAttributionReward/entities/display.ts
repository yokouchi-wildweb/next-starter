// 生成物・編集不可: pnpm generate registry が src/domains/core/couponAttributionReward/entities/couponAttributionReward/entity.json から生成する
// client に出す表示用の写し(秘密・内部の項目は持たない)。詳細: src/lib/domain/README.md

import type { DomainDisplay } from "@/lib/domain";

export const domainDisplay: DomainDisplay = {
  "singular": "coupon_attribution_reward",
  "plural": "coupon_attribution_rewards",
  "label": "クーポン帰属報酬",
  "fields": [],
  "relations": [],
  "searchFields": [],
  "useCreatedAt": false,
  "useUpdatedAt": false,
  "useSoftDelete": false
};
