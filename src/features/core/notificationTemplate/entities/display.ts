// 生成物・編集不可: pnpm registry:generate が src/features/core/notificationTemplate/domain.json から生成する
// client に出す表示用の写し(秘密・内部の項目は持たない)。詳細: src/lib/domain/README.md

import type { DomainDisplay } from "@/lib/domain/types/display";

export const domainDisplay = {
  "singular": "notification_template",
  "plural": "notification_templates",
  "label": "お知らせテンプレート",
  "fields": [
    {
      "name": "name",
      "label": "管理用名称",
      "fieldType": "string",
      "formInput": "textInput"
    },
    {
      "name": "title",
      "label": "タイトル",
      "fieldType": "string",
      "formInput": "textInput"
    },
    {
      "name": "body",
      "label": "本文",
      "fieldType": "string",
      "formInput": "textarea"
    },
    {
      "name": "variables",
      "label": "変数定義",
      "fieldType": "jsonb",
      "formInput": "custom"
    },
    {
      "name": "category",
      "label": "カテゴリ",
      "fieldType": "enum",
      "formInput": "select",
      "options": [
        {
          "value": "system",
          "label": "システム"
        },
        {
          "value": "manual",
          "label": "手動"
        }
      ]
    }
  ],
  "relations": [],
  "searchFields": [
    "name",
    "title"
  ],
  "useCreatedAt": true,
  "useUpdatedAt": true,
  "useSoftDelete": false
} as const satisfies DomainDisplay;
