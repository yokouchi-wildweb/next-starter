// 生成物・編集不可: pnpm registry:generate が src/features/core/coupon/domain.json から生成する
// client に出す表示用の写し(秘密・内部の項目は持たない)。詳細: src/lib/domain/README.md

import type { DomainDisplay } from "@/lib/domain/types/display";

export const domainDisplay = {
  "singular": "coupon",
  "plural": "coupons",
  "label": "クーポン",
  "fields": [
    {
      "name": "category",
      "label": "カテゴリ",
      "fieldType": "string",
      "formInput": "combobox"
    },
    {
      "name": "code",
      "label": "クーポンコード",
      "fieldType": "string",
      "formInput": "textInput"
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
      ]
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
      ]
    },
    {
      "name": "name",
      "label": "クーポン名",
      "fieldType": "string",
      "formInput": "textInput"
    },
    {
      "name": "description",
      "label": "説明文",
      "fieldType": "string",
      "formInput": "textarea"
    },
    {
      "name": "image_url",
      "label": "イメージ画像",
      "fieldType": "mediaUploader",
      "formInput": "mediaUploader"
    },
    {
      "name": "admin_label",
      "label": "管理者用ラベル",
      "fieldType": "string",
      "formInput": "textInput"
    },
    {
      "name": "admin_note",
      "label": "管理者用メモ",
      "fieldType": "string",
      "formInput": "textarea"
    },
    {
      "name": "valid_from",
      "label": "開始日",
      "fieldType": "timestamp With Time Zone",
      "formInput": "datetimeInput"
    },
    {
      "name": "valid_until",
      "label": "終了日",
      "fieldType": "timestamp With Time Zone",
      "formInput": "datetimeInput"
    },
    {
      "name": "max_total_uses",
      "label": "総使用回数上限",
      "fieldType": "integer",
      "formInput": "numberInput"
    },
    {
      "name": "max_uses_per_redeemer",
      "label": "使用者毎の上限",
      "fieldType": "integer",
      "formInput": "numberInput"
    },
    {
      "name": "current_total_uses",
      "label": "現在の総使用回数",
      "fieldType": "integer",
      "formInput": "none"
    },
    {
      "name": "attribution_user_id",
      "label": "帰属ユーザーID",
      "fieldType": "uuid",
      "formInput": "none"
    },
    {
      "name": "settings",
      "label": "カテゴリ設定",
      "fieldType": "jsonb",
      "formInput": "none"
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
  "useSoftDelete": true
} as const satisfies DomainDisplay;
