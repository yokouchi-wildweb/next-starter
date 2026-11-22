// 生成物・編集不可: pnpm generate extensions が src/domains/core/storageObject/extensionPoints.ts から生成する
// purposes: src/domains/core/storageObject/purposes/<名前>.ts(x) か <名前>/index.ts(x) の export const purposes(並びはファイル名の順)

import type { StoragePurposeMap } from "@/lib/storage";

import { purposes as purposes_chatRoom } from "@/domains/core/storageObject/purposes/chatRoom";
import { purposes as purposes_coupon } from "@/domains/core/storageObject/purposes/coupon";
import { purposes as purposes_demo } from "@/domains/core/storageObject/purposes/demo";
import { purposes as purposes_messaging } from "@/domains/core/storageObject/purposes/messaging";
import { purposes as purposes_purchaseRequest } from "@/domains/core/storageObject/purposes/purchaseRequest";
import { purposes as purposes_user } from "@/domains/core/storageObject/purposes/user";

export const purposes: StoragePurposeMap[] = [
  purposes_chatRoom,
  purposes_coupon,
  purposes_demo,
  purposes_messaging,
  purposes_purchaseRequest,
  purposes_user,
];
