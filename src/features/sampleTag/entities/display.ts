// 生成物・編集不可: pnpm registry:generate が src/features/sampleTag/domain.json から生成する
// client に出す表示用の写し(秘密・内部の項目は持たない)。詳細: src/lib/domain/README.md

import type { DomainDisplay } from "@/lib/domain/types/display";

export const domainDisplay = {
  "singular": "sample_tag",
  "plural": "sample_tags",
  "label": "サンプルタグ",
  "fields": [
    {
      "name": "name",
      "label": "タグ名",
      "fieldType": "string",
      "formInput": "textInput"
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
      "domain": "sample",
      "label": "サンプル名",
      "fieldName": "sample_ids",
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
