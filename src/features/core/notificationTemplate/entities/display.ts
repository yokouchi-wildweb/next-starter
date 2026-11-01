// 生成物・編集不可: pnpm registry:generate が src/features/core/notificationTemplate/domain.json から生成する
// client に出す表示用の写し(秘密・内部の項目は持たない)。詳細: src/lib/domain/README.md

import type { DomainDisplay } from "@/lib/domain/types/display";

export const domainDisplay: DomainDisplay = {
  "singular": "notification_template",
  "plural": "notification_templates",
  "label": "お知らせテンプレート",
  "fields": [
    {
      "name": "name",
      "label": "管理用名称",
      "fieldType": "string",
      "formInput": "textInput",
      "required": true
    },
    {
      "name": "title",
      "label": "タイトル",
      "fieldType": "string",
      "formInput": "textInput",
      "required": true,
      "placeholder": "{{variableName}} で変数を埋め込めます"
    },
    {
      "name": "body",
      "label": "本文",
      "fieldType": "string",
      "formInput": "textarea",
      "required": true,
      "placeholder": "{{variableName}} で変数を埋め込めます"
    },
    {
      "name": "variables",
      "label": "変数定義",
      "fieldType": "jsonb",
      "formInput": "custom",
      "required": false
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
      ],
      "required": true
    }
  ],
  "relations": [],
  "searchFields": [
    "name",
    "title"
  ],
  "useCreatedAt": true,
  "useUpdatedAt": true,
  "useSoftDelete": false,
  "tableFields": [
    "name",
    "title",
    "category",
    "updatedAt"
  ]
};
