// 生成物・編集不可: pnpm extensions:generate が src/features/core/storageObject/extensionPoints.ts から生成する
// purposes: src/features/core/storageObject/purposes/<名前>[.<fork の名前>].ts(x) か <名前>[.<fork の名前>]/index.ts(x) の export const purposes(並びはファイル名の順)

import type { StoragePurposeMap } from "@/lib/storage";

import { purposes as chatRoom } from "@/features/core/storageObject/purposes/chatRoom";
import { purposes as coupon } from "@/features/core/storageObject/purposes/coupon";
import { purposes as demo } from "@/features/core/storageObject/purposes/demo";
import { purposes as notification } from "@/features/core/storageObject/purposes/notification";
import { purposes as purchaseRequest } from "@/features/core/storageObject/purposes/purchaseRequest";
import { purposes as user } from "@/features/core/storageObject/purposes/user";

export const purposes: StoragePurposeMap[] = [
  chatRoom,
  coupon,
  demo,
  notification,
  purchaseRequest,
  user,
];
