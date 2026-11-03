// 生成物・編集不可: pnpm extensions:generate が src/features/core/storageObject/extensionPoints.ts から生成する
// purposes: src/features/core/storageObject/purposes/<名前>.ts(x) か <名前>/index.ts(x) の export const purposes(並びはファイル名の順)

import type { StoragePurposeMap } from "@/lib/storage";

import { purposes as purposes_chatRoom } from "@/features/core/storageObject/purposes/chatRoom";
import { purposes as purposes_coupon } from "@/features/core/storageObject/purposes/coupon";
import { purposes as purposes_demo } from "@/features/core/storageObject/purposes/demo";
import { purposes as purposes_notification } from "@/features/core/storageObject/purposes/notification";
import { purposes as purposes_purchaseRequest } from "@/features/core/storageObject/purposes/purchaseRequest";
import { purposes as purposes_user } from "@/features/core/storageObject/purposes/user";

export const purposes: StoragePurposeMap[] = [
  purposes_chatRoom,
  purposes_coupon,
  purposes_demo,
  purposes_notification,
  purposes_purchaseRequest,
  purposes_user,
];
