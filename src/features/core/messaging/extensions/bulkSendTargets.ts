// 生成物・編集不可: pnpm generate extensions が src/features/core/messaging/extensionPoints.ts から生成する
// bulkSendTargets: src/features/core/messaging/bulkSendTargets/<名前>.ts(x) か <名前>/index.ts(x) の export const bulkSendTarget(並びはファイル名の順)

import type { MessageBulkSendTarget } from "@/features/core/messaging/services/server/admin/types";

import { bulkSendTarget as bulkSendTargets_bankTransferReview } from "@/features/core/messaging/bulkSendTargets/bankTransferReview";

const bulkSendTargetsList: MessageBulkSendTarget[] = [
  bulkSendTargets_bankTransferReview,
];
export const bulkSendTargets: Readonly<Record<string, MessageBulkSendTarget>> = Object.assign(Object.create(null), Object.fromEntries(bulkSendTargetsList.map((item) => [String(item.key), item])));
if (Object.keys(bulkSendTargets).length !== bulkSendTargetsList.length) throw new Error("bulkSendTargets: key が重複している項目がある");
