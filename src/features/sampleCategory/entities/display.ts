// 生成物・編集不可: pnpm registry:generate が src/features/sampleCategory/domain.json から生成する
// client に出す表示用の写し(秘密・内部の項目は持たない)。詳細: src/lib/domain/README.md

import type { DomainDisplay } from "@/lib/domain/types/display";

export const domainDisplay = {
  "singular": "sample_category",
  "plural": "sample_categories",
  "label": "サンプルカテゴリ",
  "fields": [
    {
      "name": "name",
      "label": "カテゴリ名",
      "fieldType": "string",
      "formInput": "textInput"
    },
    {
      "name": "description",
      "label": "説明文",
      "fieldType": "string",
      "formInput": "textarea"
    }
  ],
  "relations": [
    {
      "domain": "sample",
      "label": "サンプル",
      "fieldName": "sample_category_id",
      "relationType": "hasMany"
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
