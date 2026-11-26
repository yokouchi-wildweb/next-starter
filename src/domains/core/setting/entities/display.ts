// 生成物・編集不可: pnpm generate registry が src/domains/core/setting/entities/setting/entity.json から生成する
// client に出す表示用の写し(秘密・内部の項目は持たない)。詳細: src/lib/domain/README.md

import type { DomainDisplay } from "@/lib/domain";

export const domainDisplay: DomainDisplay = {
  "singular": "setting",
  "plural": "settings",
  "label": "設定",
  "fields": [],
  "relations": [],
  "searchFields": [],
  "useCreatedAt": true,
  "useUpdatedAt": true,
  "useSoftDelete": false
};
