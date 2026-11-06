// 生成物・編集不可: pnpm generate registry が src/features/core/referralReward/domain.json から生成する
// client に出す表示用の写し(秘密・内部の項目は持たない)。詳細: src/lib/domain/README.md

import type { DomainDisplay } from "@/lib/domain/types/display";

export const domainDisplay: DomainDisplay = {
  "singular": "referralReward",
  "plural": "referralRewards",
  "label": "紹介報酬",
  "fields": [
    {
      "name": "referral_id",
      "label": "紹介ID",
      "fieldType": "uuid",
      "formInput": "none",
      "required": true
    },
    {
      "name": "reward_key",
      "label": "報酬キー",
      "fieldType": "string",
      "formInput": "textInput",
      "required": true
    },
    {
      "name": "recipient_user_id",
      "label": "受取人ID",
      "fieldType": "uuid",
      "formInput": "none",
      "required": true
    },
    {
      "name": "status",
      "label": "ステータス",
      "fieldType": "enum",
      "formInput": "radio",
      "options": [
        {
          "value": "pending",
          "label": "保留"
        },
        {
          "value": "fulfilled",
          "label": "付与済"
        },
        {
          "value": "failed",
          "label": "失敗"
        }
      ],
      "required": true,
      "defaultValue": "pending"
    },
    {
      "name": "fulfilled_at",
      "label": "付与日時",
      "fieldType": "timestamp With Time Zone",
      "formInput": "none",
      "required": false
    },
    {
      "name": "metadata",
      "label": "メタデータ",
      "fieldType": "jsonb",
      "formInput": "none",
      "required": false
    }
  ],
  "relations": [],
  "searchFields": [
    "referral_id",
    "reward_key",
    "recipient_user_id"
  ],
  "useCreatedAt": true,
  "useUpdatedAt": true,
  "useSoftDelete": false,
  "useImportExport": false,
  "tableFields": [
    "referral_id",
    "reward_key",
    "recipient_user_id",
    "status",
    "fulfilled_at",
    "createdAt"
  ]
};
