// 生成物・編集不可: pnpm registry:generate が src/features/core/purchaseQuota/domain.json から生成する
// client に出す表示用の写し(秘密・内部の項目は持たない)。詳細: src/lib/domain/README.md

import type { DomainDisplay } from "@/lib/domain/types/display";

export const domainDisplay = {
  "singular": "purchase_quota_ledger",
  "plural": "purchase_quota_ledger",
  "label": "購入クォータ台帳",
  "fields": [
    {
      "name": "user_id",
      "label": "ユーザーID",
      "fieldType": "text",
      "formInput": "none"
    },
    {
      "name": "payment_method",
      "label": "決済方法",
      "fieldType": "text",
      "formInput": "none"
    },
    {
      "name": "amount",
      "label": "金額",
      "fieldType": "integer",
      "formInput": "none"
    },
    {
      "name": "purchase_request_id",
      "label": "購入リクエストID",
      "fieldType": "text",
      "formInput": "none"
    },
    {
      "name": "status",
      "label": "ステータス",
      "fieldType": "text",
      "formInput": "none"
    },
    {
      "name": "created_at",
      "label": "作成日時",
      "fieldType": "timestamp With Time Zone",
      "formInput": "none"
    },
    {
      "name": "updated_at",
      "label": "更新日時",
      "fieldType": "timestamp With Time Zone",
      "formInput": "none"
    }
  ],
  "relations": [],
  "searchFields": [],
  "useCreatedAt": false,
  "useUpdatedAt": false,
  "useSoftDelete": false
} as const satisfies DomainDisplay;
