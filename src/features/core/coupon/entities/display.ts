// 生成物・編集不可: pnpm generate registry が src/features/core/coupon/domain.json から生成する
// client に出す表示用の写し(秘密・内部の項目は持たない)。詳細: src/lib/domain/README.md

import type { DomainDisplay } from "@/lib/domain/types/display";

export const domainDisplay: DomainDisplay = {
  "singular": "coupon",
  "plural": "coupons",
  "label": "クーポン",
  "fields": [
    {
      "name": "category",
      "label": "カテゴリ",
      "fieldType": "string",
      "formInput": "combobox",
      "required": false
    },
    {
      "name": "code",
      "label": "クーポンコード",
      "fieldType": "string",
      "formInput": "textInput",
      "required": true
    },
    {
      "name": "type",
      "label": "種別",
      "fieldType": "enum",
      "formInput": "radio",
      "options": [
        {
          "value": "official",
          "label": "公式プロモーション"
        },
        {
          "value": "affiliate",
          "label": "アフィリエイト"
        },
        {
          "value": "invite",
          "label": "ユーザー招待"
        }
      ],
      "required": true,
      "defaultValue": "official"
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
          "value": "inactive",
          "label": "無効"
        }
      ],
      "required": true,
      "defaultValue": "active"
    },
    {
      "name": "name",
      "label": "クーポン名",
      "fieldType": "string",
      "formInput": "textInput",
      "required": true
    },
    {
      "name": "description",
      "label": "説明文",
      "fieldType": "string",
      "formInput": "textarea",
      "required": false
    },
    {
      "name": "image_url",
      "label": "イメージ画像",
      "fieldType": "mediaUploader",
      "formInput": "mediaUploader",
      "required": false,
      "accept": "image/*"
    },
    {
      "name": "admin_label",
      "label": "管理者用ラベル",
      "fieldType": "string",
      "formInput": "textInput",
      "required": false
    },
    {
      "name": "admin_note",
      "label": "管理者用メモ",
      "fieldType": "string",
      "formInput": "textarea",
      "required": false
    },
    {
      "name": "valid_from",
      "label": "開始日",
      "fieldType": "timestamp With Time Zone",
      "formInput": "datetimeInput",
      "required": false
    },
    {
      "name": "valid_until",
      "label": "終了日",
      "fieldType": "timestamp With Time Zone",
      "formInput": "datetimeInput",
      "required": false
    },
    {
      "name": "max_total_uses",
      "label": "総使用回数上限",
      "fieldType": "integer",
      "formInput": "numberInput",
      "required": false
    },
    {
      "name": "max_uses_per_redeemer",
      "label": "使用者毎の上限",
      "fieldType": "integer",
      "formInput": "numberInput",
      "required": false
    },
    {
      "name": "current_total_uses",
      "label": "現在の総使用回数",
      "fieldType": "integer",
      "formInput": "none",
      "required": true,
      "defaultValue": 0
    },
    {
      "name": "attribution_user_id",
      "label": "帰属ユーザーID",
      "fieldType": "uuid",
      "formInput": "none",
      "required": false
    },
    {
      "name": "settings",
      "label": "カテゴリ設定",
      "fieldType": "jsonb",
      "formInput": "none",
      "required": false
    }
  ],
  "relations": [],
  "searchFields": [
    "code",
    "name",
    "category",
    "admin_label"
  ],
  "useCreatedAt": true,
  "useUpdatedAt": true,
  "useSoftDelete": true,
  "useImportExport": false,
  "fieldGroups": [
    {
      "key": "code",
      "label": "",
      "fields": [
        "type",
        "category",
        "code"
      ]
    },
    {
      "key": "basic",
      "label": "基本設定",
      "fields": [
        "name",
        "status",
        "description",
        "image_url"
      ],
      "bgColor": "#f0f7ff"
    },
    {
      "key": "limits",
      "label": "使用制限",
      "fields": [
        "valid_from",
        "valid_until",
        "max_total_uses",
        "max_uses_per_redeemer"
      ],
      "bgColor": "#fffbe6"
    },
    {
      "key": "admin",
      "label": "",
      "fields": [
        "admin_label",
        "admin_note"
      ],
      "bgColor": "#fff1f0"
    }
  ],
  "tableFields": [
    "code",
    "type",
    "category",
    "status",
    "name",
    "admin_label",
    "current_total_uses",
    "valid_until",
    "updatedAt"
  ]
};
