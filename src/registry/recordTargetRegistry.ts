// 生成物・編集不可: pnpm generate registry が src/features/**/recordTargets/*.ts・*.override.ts から生成する
// src/registry/recordTargetRegistry.ts
//
// 記録の宛先の一覧(鍵 = <ドメインのフォルダ名>.<ファイル名> → ドメイン・項目と上書きの遅延 import)。絞らない: 読み手は loadRecordTarget(門番 recordTargetOpen)を通す
// (messaging/services/server/domainGate.ts)。型と決まり: src/lib/messaging/README.md「記録の宛先」

import "server-only";

import type { MessageRecordTargetRegistry } from "@/lib/messaging";

export const recordTargetRegistry: MessageRecordTargetRegistry = {
  "bankTransferReview.reviews": {
    key: "bankTransferReview.reviews",
    domain: "bankTransferReview",
    target: () => import("@/features/core/bankTransferReview/recordTargets/reviews"),
  },
  "user.users": {
    key: "user.users",
    domain: "user",
    target: () => import("@/features/core/user/recordTargets/users"),
  },
};
