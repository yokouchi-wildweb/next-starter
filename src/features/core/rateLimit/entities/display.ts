// 生成物・編集不可: pnpm registry:generate が src/features/core/rateLimit/domain.json から生成する
// client に出す表示用の写し(秘密・内部の項目は持たない)。詳細: src/lib/domain/README.md

import type { DomainDisplay } from "@/lib/domain/types/display";

export const domainDisplay: DomainDisplay = {
  "singular": "rate_limit",
  "plural": "rate_limits",
  "label": "レート制限",
  "fields": [
    {
      "name": "count",
      "label": "カウント",
      "fieldType": "integer",
      "formInput": "none",
      "required": true,
      "defaultValue": 1
    },
    {
      "name": "window_start",
      "label": "ウィンドウ開始",
      "fieldType": "timestamp With Time Zone",
      "formInput": "none",
      "required": true
    },
    {
      "name": "expires_at",
      "label": "有効期限",
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
