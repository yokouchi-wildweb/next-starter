// 生成物・編集不可: pnpm registry:generate が src/features/core/referral/domain.json から生成する
// client に出す表示用の写し(秘密・内部の項目は持たない)。詳細: src/lib/domain/README.md

import type { DomainDisplay } from "@/lib/domain/types/display";

export const domainDisplay = {
  "singular": "referral",
  "plural": "referrals",
  "label": "紹介",
  "fields": [
    {
      "name": "coupon_id",
      "label": "クーポンID",
      "fieldType": "uuid",
      "formInput": "none"
    },
    {
      "name": "inviter_user_id",
      "label": "招待者ID",
      "fieldType": "uuid",
      "formInput": "none"
    },
    {
      "name": "invitee_user_id",
      "label": "被招待者ID",
      "fieldType": "uuid",
      "formInput": "none"
    },
    {
      "name": "status",
      "label": "ステータス",
      "fieldType": "enum",
      "formInput": "radio",
      "options": [
        {
          "value": "active",
          "label": "有効"
        },
        {
          "value": "cancelled",
          "label": "取消"
        }
      ]
    }
  ],
  "relations": [],
  "searchFields": [
    "inviter_user_id",
    "invitee_user_id"
  ],
  "useCreatedAt": true,
  "useUpdatedAt": true,
  "useSoftDelete": false
} as const satisfies DomainDisplay;
