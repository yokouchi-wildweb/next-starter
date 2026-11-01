// 生成物・編集不可: pnpm registry:generate が src/features/core/purchaseQuota/domain.json から生成する
// client に出す表示用の写し(秘密・内部の項目は持たない)。詳細: src/lib/domain/README.md

import type { DomainDisplay } from "@/lib/domain/types/display";

export const domainDisplay: DomainDisplay = {
  "singular": "purchase_quota_ledger",
  "plural": "purchase_quota_ledger",
  "label": "購入クォータ台帳",
  "fields": [
    {
      "name": "user_id",
      "label": "ユーザーID",
      "fieldType": "string",
      "formInput": "none",
      "required": true
    },
    {
      "name": "payment_method",
      "label": "決済方法",
      "fieldType": "string",
      "formInput": "none",
      "required": true
    },
    {
      "name": "amount",
      "label": "金額",
      "fieldType": "integer",
      "formInput": "none",
      "required": true
    },
    {
      "name": "purchase_request_id",
      "label": "購入リクエストID",
      "fieldType": "string",
      "formInput": "none",
      "required": true
    },
    {
      "name": "status",
      "label": "ステータス",
      "fieldType": "string",
      "formInput": "none",
      "required": true
    },
    {
      "name": "created_at",
      "label": "作成日時",
      "fieldType": "timestamp With Time Zone",
      "formInput": "none",
      "required": true
    },
    {
      "name": "updated_at",
      "label": "更新日時",
      "fieldType": "timestamp With Time Zone",
      "formInput": "none",
      "required": true
    }
  ],
  "relations": [],
  "searchFields": [],
  "useCreatedAt": false,
  "useUpdatedAt": false,
  "useSoftDelete": false
};
