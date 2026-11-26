// 生成物・編集不可: pnpm generate registry が src/domains/core/bankTransferReview/entities/bankTransferReview/entity.json から生成する
// client に出す表示用の写し(秘密・内部の項目は持たない)。詳細: src/lib/domain/README.md

import type { DomainDisplay } from "@/lib/domain";

export const domainDisplay: DomainDisplay = {
  "singular": "bank_transfer_review",
  "plural": "bank_transfer_reviews",
  "label": "振込の確認",
  "fields": [],
  "relations": [],
  "searchFields": [],
  "useCreatedAt": true,
  "useUpdatedAt": true,
  "useSoftDelete": false
};
