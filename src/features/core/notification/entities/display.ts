// 生成物・編集不可: pnpm registry:generate が src/features/core/notification/domain.json から生成する
// client に出す表示用の写し(秘密・内部の項目は持たない)。詳細: src/lib/domain/README.md

import type { DomainDisplay } from "@/lib/domain/types/display";

export const domainDisplay = {
  "singular": "notification",
  "plural": "notifications",
  "label": "お知らせ",
  "fields": [
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
      "name": "image",
      "label": "画像",
      "fieldType": "mediaUploader",
      "formInput": "mediaUploader"
    },
    {
      "name": "target_type",
      "label": "送信対象",
      "fieldType": "enum",
      "formInput": "select",
      "options": [
        {
          "value": "all",
          "label": "全員"
        },
        {
          "value": "role",
          "label": "ロール指定"
        },
        {
          "value": "individual",
          "label": "個別指定"
        }
      ]
    },
    {
      "name": "target_user_ids",
      "label": "対象ユーザーID",
      "fieldType": "array",
      "formInput": "none"
    },
    {
      "name": "target_roles",
      "label": "対象ロール",
      "fieldType": "array",
      "formInput": "none"
    },
    {
      "name": "sender_type",
      "label": "送信者種別",
      "fieldType": "enum",
      "formInput": "hidden",
      "options": [
        {
          "value": "admin",
          "label": "管理者"
        },
        {
          "value": "system",
          "label": "システム"
        }
      ]
    },
    {
      "name": "created_by_id",
      "label": "作成者ID",
      "fieldType": "uuid",
      "formInput": "none"
    },
    {
      "name": "metadata",
      "label": "メタデータ",
      "fieldType": "jsonb",
      "formInput": "none"
    },
    {
      "name": "published_at",
      "label": "公開日時",
      "fieldType": "timestamp With Time Zone",
      "formInput": "datetimeInput"
    }
  ],
  "relations": [
    {
      "domain": "notification_template",
      "label": "テンプレート",
      "fieldName": "notification_template_id",
      "fieldType": "uuid",
      "relationType": "belongsTo",
      "required": false
    }
  ],
  "searchFields": [
    "title"
  ],
  "useCreatedAt": true,
  "useUpdatedAt": true,
  "useSoftDelete": false
} as const satisfies DomainDisplay;
