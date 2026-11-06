// 生成物・編集不可: pnpm generate registry が src/features/core/userLineProfile/domain.json から生成する
// client に出す表示用の写し(秘密・内部の項目は持たない)。詳細: src/lib/domain/README.md

import type { DomainDisplay } from "@/lib/domain/types/display";

export const domainDisplay: DomainDisplay = {
  "singular": "user_line_profile",
  "plural": "user_line_profiles",
  "label": "LINE連携プロフィール",
  "fields": [
    {
      "name": "line_user_id",
      "label": "LINE ユーザーID",
      "fieldType": "string",
      "formInput": "none",
      "required": true
    },
    {
      "name": "display_name",
      "label": "LINE表示名",
      "fieldType": "string",
      "formInput": "none",
      "required": false
    },
    {
      "name": "picture_url",
      "label": "LINEプロフィール画像URL",
      "fieldType": "string",
      "formInput": "none",
      "required": false
    }
  ],
  "relations": [
    {
      "domain": "user",
      "label": "ユーザー",
      "fieldName": "user_id",
      "fieldType": "uuid",
      "relationType": "belongsTo",
      "required": true
    }
  ],
  "searchFields": [],
  "useCreatedAt": true,
  "useUpdatedAt": true,
  "useSoftDelete": false,
  "useImportExport": false
};
