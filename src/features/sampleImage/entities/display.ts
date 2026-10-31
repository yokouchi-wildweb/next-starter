// 生成物・編集不可: pnpm registry:generate が src/features/sampleImage/domain.json から生成する
// client に出す表示用の写し(秘密・内部の項目は持たない)。詳細: src/lib/domain/README.md

import type { DomainDisplay } from "@/lib/domain/types/display";

export const domainDisplay = {
  "singular": "sample_image",
  "plural": "sample_images",
  "label": "画像",
  "fields": [
    {
      "name": "file",
      "label": "画像",
      "fieldType": "mediaUploader",
      "formInput": "mediaUploader"
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
      "domain": "sample",
      "label": "サンプル",
      "fieldName": "sample_id",
      "fieldType": "uuid",
      "relationType": "belongsTo",
      "required": true
    }
  ],
  "searchFields": [],
  "useCreatedAt": true,
  "useUpdatedAt": true,
  "useSoftDelete": false
} as const satisfies DomainDisplay;
