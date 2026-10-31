// 生成物・編集不可: pnpm registry:generate が src/features/sample/domain.json から生成する
// client に出す表示用の写し(秘密・内部の項目は持たない)。詳細: src/lib/domain/README.md

import type { DomainDisplay } from "@/lib/domain/types/display";

export const domainDisplay = {
  "singular": "sample",
  "plural": "samples",
  "label": "サンプル",
  "fields": [
    {
      "name": "name",
      "label": "名前",
      "fieldType": "string",
      "formInput": "textInput"
    },
    {
      "name": "number",
      "label": "数字",
      "fieldType": "integer",
      "formInput": "numberInput"
    },
    {
      "name": "rich_number",
      "label": "リッチナンバー",
      "fieldType": "integer",
      "formInput": "stepperInput"
    },
    {
      "name": "switch",
      "label": "スイッチ",
      "fieldType": "boolean",
      "formInput": "switchInput"
    },
    {
      "name": "radio",
      "label": "ラジオボタン",
      "fieldType": "boolean",
      "formInput": "radio",
      "options": [
        {
          "value": true,
          "label": "はい"
        },
        {
          "value": false,
          "label": "いいえ"
        }
      ]
    },
    {
      "name": "select",
      "label": "セレクトボックス（Enum）",
      "fieldType": "enum",
      "formInput": "select",
      "options": [
        {
          "value": "apple",
          "label": "りんご"
        },
        {
          "value": "orange",
          "label": "オレンジ"
        },
        {
          "value": "berry",
          "label": "いちご"
        }
      ]
    },
    {
      "name": "multi_select",
      "label": "マルチセレクトコンボ",
      "fieldType": "array",
      "formInput": "multiSelect",
      "options": [
        {
          "value": "apple",
          "label": "りんご"
        },
        {
          "value": "orange",
          "label": "オレンジ"
        },
        {
          "value": "cherry",
          "label": "さくらんぼ"
        }
      ]
    },
    {
      "name": "sale_start_at",
      "label": "販売開始日",
      "fieldType": "timestamp With Time Zone",
      "formInput": "datetimeInput"
    },
    {
      "name": "date",
      "label": "日付",
      "fieldType": "date",
      "formInput": "dateInput"
    },
    {
      "name": "time",
      "label": "時間",
      "fieldType": "time",
      "formInput": "timeInput"
    },
    {
      "name": "main_image",
      "label": "メイン画像",
      "fieldType": "mediaUploader",
      "formInput": "mediaUploader"
    },
    {
      "name": "sub_image",
      "label": "サブ画像",
      "fieldType": "mediaUploader",
      "formInput": "mediaUploader"
    },
    {
      "name": "images",
      "label": "画像",
      "fieldType": "mediaCollection",
      "formInput": "mediaUploaderMulti"
    },
    {
      "name": "description",
      "label": "説明文",
      "fieldType": "string",
      "formInput": "textarea"
    },
    {
      "name": "sort_order",
      "label": "並び順",
      "fieldType": "string",
      "formInput": "hidden"
    }
  ],
  "relations": [
    {
      "domain": "sample_category",
      "label": "サンプルカテゴリ",
      "fieldName": "sample_category_id",
      "fieldType": "uuid",
      "relationType": "belongsTo",
      "required": false
    },
    {
      "domain": "sample_tag",
      "label": "サンプルタグ",
      "fieldName": "sample_tag_ids",
      "fieldType": "uuid",
      "relationType": "belongsToMany",
      "required": false,
      "formInput": "asyncMultiSelect",
      "includeRelationTable": true,
      "searchFields": [
        "name",
        "description"
      ]
    }
  ],
  "searchFields": [
    "name",
    "description"
  ],
  "useCreatedAt": true,
  "useUpdatedAt": true,
  "useSoftDelete": true
} as const satisfies DomainDisplay;
