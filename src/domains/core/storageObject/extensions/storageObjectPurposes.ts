// 生成物・編集不可: pnpm generate extensions が src/domains/core/storageObject/extensionPoints.ts から生成する
// storageObjectPurposes: 差す側の <ドメイン>/plugs/storageObjectPurposes/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const purposes(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)

import type { StoragePurposeMap } from "@/lib/storage";

import { purposes as storageObjectPurposes_chatRoom_chatRoom } from "@/domains/core/chatRoom/plugs/storageObjectPurposes/chatRoom";
import { purposes as storageObjectPurposes_coupon_coupon } from "@/domains/core/coupon/plugs/storageObjectPurposes/coupon";
import { purposes as storageObjectPurposes_demo_demo } from "@/domains/core/demo/plugs/storageObjectPurposes/demo";
import { purposes as storageObjectPurposes_messaging_messaging } from "@/domains/core/messaging/plugs/storageObjectPurposes/messaging";
import { purposes as storageObjectPurposes_purchaseRequest_purchaseRequest } from "@/domains/core/purchaseRequest/plugs/storageObjectPurposes/purchaseRequest";
import { purposes as storageObjectPurposes_user_user } from "@/domains/core/user/plugs/storageObjectPurposes/user";

export const storageObjectPurposes: { domain: string | null; name: string; requires: readonly string[]; plug: StoragePurposeMap }[] = [
  { domain: "chatRoom", name: "chatRoom", requires: [], plug: storageObjectPurposes_chatRoom_chatRoom },
  { domain: "coupon", name: "coupon", requires: [], plug: storageObjectPurposes_coupon_coupon },
  { domain: "demo", name: "demo", requires: [], plug: storageObjectPurposes_demo_demo },
  { domain: "messaging", name: "messaging", requires: [], plug: storageObjectPurposes_messaging_messaging },
  { domain: "purchaseRequest", name: "purchaseRequest", requires: ["wallet", "walletHistory"], plug: storageObjectPurposes_purchaseRequest_purchaseRequest },
  { domain: "user", name: "user", requires: [], plug: storageObjectPurposes_user_user },
];
