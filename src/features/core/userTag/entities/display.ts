// 生成物・編集不可: pnpm registry:generate が src/features/core/userTag/domain.json から生成する
// client に出す表示用の写し(秘密・内部の項目は持たない)。詳細: src/lib/domain/README.md

import type { DomainDisplay } from "@/lib/domain/types/display";

export const domainDisplay = {
  "singular": "user_tag",
  "plural": "user_tags",
  "label": "ユーザータグ",
  "fields": [
    {
      "name": "name",
      "label": "タグ名",
      "fieldType": "string",
      "formInput": "textInput"
    },
    {
      "name": "color",
      "label": "カラー",
      "fieldType": "string",
      "formInput": "select",
      "options": [
        {
          "value": "primary",
          "label": "プライマリ"
        },
        {
          "value": "secondary",
          "label": "セカンダリ"
        },
        {
          "value": "accent",
          "label": "アクセント"
        },
        {
          "value": "success",
          "label": "成功色"
        },
        {
          "value": "warning",
          "label": "注意色"
        },
        {
          "value": "destructive",
          "label": "警告色"
        },
        {
          "value": "red",
          "label": "レッド"
        },
        {
          "value": "orange",
          "label": "オレンジ"
        },
        {
          "value": "yellow",
          "label": "イエロー"
        },
        {
          "value": "green",
          "label": "グリーン"
        },
        {
          "value": "blue",
          "label": "ブルー"
        },
        {
          "value": "purple",
          "label": "パープル"
        },
        {
          "value": "pink",
          "label": "ピンク"
        },
        {
          "value": "gray",
          "label": "グレー"
        }
      ]
    },
    {
      "name": "description",
      "label": "説明",
      "fieldType": "string",
      "formInput": "textarea"
    }
  ],
  "relations": [
    {
      "domain": "user",
      "label": "ユーザー",
      "fieldName": "user_ids",
      "fieldType": "uuid",
      "relationType": "belongsToMany",
      "required": false,
      "includeRelationTable": false
    }
  ],
  "searchFields": [
    "name",
    "description"
  ],
  "useCreatedAt": true,
  "useUpdatedAt": true,
  "useSoftDelete": false
} as const satisfies DomainDisplay;
