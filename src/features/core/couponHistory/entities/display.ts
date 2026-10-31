// 生成物・編集不可: pnpm registry:generate が src/features/core/couponHistory/domain.json から生成する
// client に出す表示用の写し(秘密・内部の項目は持たない)。詳細: src/lib/domain/README.md

import type { DomainDisplay } from "@/lib/domain/types/display";

export const domainDisplay = {
  "singular": "couponHistory",
  "plural": "couponHistories",
  "label": "クーポン使用履歴",
  "fields": [
    {
      "name": "coupon_id",
      "label": "クーポンID",
      "fieldType": "uuid",
      "formInput": "none"
    },
    {
      "name": "redeemer_user_id",
      "label": "使用者ID",
      "fieldType": "uuid",
      "formInput": "none"
    },
    {
      "name": "metadata",
      "label": "メタデータ",
      "fieldType": "jsonb",
      "formInput": "none"
    }
  ],
  "relations": [],
  "searchFields": [
    "coupon_id",
    "redeemer_user_id"
  ],
  "useCreatedAt": true,
  "useUpdatedAt": false,
  "useSoftDelete": false
} as const satisfies DomainDisplay;
