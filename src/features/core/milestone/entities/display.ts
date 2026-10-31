// 生成物・編集不可: pnpm registry:generate が src/features/core/milestone/domain.json から生成する
// client に出す表示用の写し(秘密・内部の項目は持たない)。詳細: src/lib/domain/README.md

import type { DomainDisplay } from "@/lib/domain/types/display";

export const domainDisplay = {
  "singular": "milestone",
  "plural": "milestones",
  "label": "マイルストーン",
  "fields": [
    {
      "name": "user_id",
      "label": "ユーザーID",
      "fieldType": "uuid",
      "formInput": "hidden"
    },
    {
      "name": "milestone_key",
      "label": "マイルストーンキー",
      "fieldType": "string",
      "formInput": "hidden"
    },
    {
      "name": "achieved_at",
      "label": "達成日時",
      "fieldType": "timestamp With Time Zone",
      "formInput": "hidden"
    },
    {
      "name": "metadata",
      "label": "メタデータ",
      "fieldType": "jsonb",
      "formInput": "hidden"
    }
  ],
  "relations": [],
  "searchFields": [
    "user_id",
    "milestone_key"
  ],
  "useCreatedAt": true,
  "useUpdatedAt": false,
  "useSoftDelete": false
} as const satisfies DomainDisplay;
