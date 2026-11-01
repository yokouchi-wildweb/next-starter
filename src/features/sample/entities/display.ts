// 生成物・編集不可: pnpm registry:generate が src/features/sample/domain.json から生成する
// client に出す表示用の写し(秘密・内部の項目は持たない)。詳細: src/lib/domain/README.md

import type { DomainDisplay } from "@/lib/domain/types/display";

export const domainDisplay: DomainDisplay = {
  "singular": "sample",
  "plural": "samples",
  "label": "サンプル",
  "fields": [
    {
      "name": "name",
      "label": "名前",
      "fieldType": "string",
      "formInput": "textInput",
      "required": true
    },
    {
      "name": "number",
      "label": "数字",
      "fieldType": "integer",
      "formInput": "numberInput",
      "required": false,
      "readonly": false,
      "defaultValue": 999
    },
    {
      "name": "rich_number",
      "label": "リッチナンバー",
      "fieldType": "integer",
      "formInput": "stepperInput",
      "required": false
    },
    {
      "name": "switch",
      "label": "スイッチ",
      "fieldType": "boolean",
      "formInput": "switchInput",
      "required": false
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
      ],
      "required": false,
      "displayType": "bookmark"
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
      ],
      "required": false,
      "defaultValue": "orange"
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
      ],
      "required": false
    },
    {
      "name": "sale_start_at",
      "label": "販売開始日",
      "fieldType": "timestamp With Time Zone",
      "formInput": "datetimeInput",
      "required": false
    },
    {
      "name": "date",
      "label": "日付",
      "fieldType": "date",
      "formInput": "dateInput",
      "required": false
    },
    {
      "name": "time",
      "label": "時間",
      "fieldType": "time",
      "formInput": "timeInput",
      "required": false
    },
    {
      "name": "main_image",
      "label": "メイン画像",
      "fieldType": "mediaUploader",
      "formInput": "mediaUploader",
      "required": false,
      "accept": "image/*,video/*",
      "validationRule": {
        "maxSizeBytes": 104857600
      }
    },
    {
      "name": "sub_image",
      "label": "サブ画像",
      "fieldType": "mediaUploader",
      "formInput": "mediaUploader",
      "required": false,
      "accept": "image/*,video/*",
      "validationRule": {
        "maxSizeBytes": 104857600
      }
    },
    {
      "name": "images",
      "label": "画像",
      "fieldType": "mediaCollection",
      "formInput": "mediaUploaderMulti",
      "required": false,
      "reorderable": true
    },
    {
      "name": "description",
      "label": "説明文",
      "fieldType": "string",
      "formInput": "textarea",
      "required": false,
      "readonly": false
    },
    {
      "name": "sort_order",
      "label": "並び順",
      "fieldType": "string",
      "formInput": "hidden",
      "required": false
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
  "useSoftDelete": true,
  "useImportExport": true,
  "sortOrderField": "sort_order",
  "fieldGroups": [
    {
      "key": "basic",
      "label": "基本情報",
      "fields": [
        "name",
        "description"
      ],
      "bgColor": "#f0f7ff"
    },
    {
      "key": "numbers",
      "label": "数値設定",
      "fields": [
        "number",
        "rich_number"
      ],
      "bgColor": "#fff7e6"
    },
    {
      "key": "selections",
      "label": "選択項目",
      "fields": [
        "switch",
        "radio",
        "select",
        "multi_select"
      ],
      "collapsible": true,
      "bgColor": "#f6ffed"
    },
    {
      "key": "datetime",
      "label": "日時設定",
      "fields": [
        "sale_start_at",
        "date",
        "time"
      ],
      "collapsible": true,
      "defaultCollapsed": true,
      "bgColor": "#fff0f6"
    },
    {
      "key": "media",
      "label": "メディア",
      "fields": [
        "main_image",
        "sub_image",
        "images"
      ],
      "bgColor": "#f5f5f5"
    }
  ],
  "tableFields": [
    "name",
    "number",
    "rich_number",
    "switch",
    "radio",
    "select",
    "main_image",
    "images",
    "description",
    "updatedAt"
  ]
};
